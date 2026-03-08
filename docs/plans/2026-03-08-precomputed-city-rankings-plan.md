# Precomputed City Rankings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the in-browser 1,486-city parallel fetch with a pre-computed Vercel Blob so `CityRankingChart` loads instantly from one HTTP request.

**Architecture:** A GitHub Actions cron (every 30 min) runs `scripts/precompute-city-rankings.mjs`, which fetches per-city data, merges it into two blobs (`city-rankings-he.json` / `city-rankings-en.json`), and uploads to Vercel Blob. The app fetches the blob once via `useCityRankings`, cached forever by React Query.

**Tech Stack:** GitHub Actions, Node.js ESM, `@vercel/blob`, oref API, Next.js, React Query.

**Design doc:** `docs/plans/2026-03-08-precomputed-city-rankings-design.md`

---

## Task 1: Install `@vercel/blob`

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install the package**

```bash
npm install @vercel/blob
```

**Step 2: Verify it appears in package.json**

```bash
grep '@vercel/blob' package.json
```

Expected: `"@vercel/blob": "^x.x.x"` in dependencies.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @vercel/blob"
```

---

## Task 2: Create `scripts/precompute-city-rankings.mjs`

**Files:**
- Create: `scripts/precompute-city-rankings.mjs`

This script handles both cold start (first ever run, no blob exists) and delta runs (blob exists, update today only). Both languages are processed in parallel; blobs are only uploaded after both complete successfully.

**Step 1: Create the script**

`scripts/precompute-city-rankings.mjs`:

```js
/**
 * Precomputes city alert rankings and uploads two Vercel Blob files:
 *   city-rankings-he.json  (Hebrew city names)
 *   city-rankings-en.json  (English city names)
 *
 * Cold start (no blob yet): fetches 30-day history (mode=3) for every city.
 * Delta run (blob exists):  archives current blob once per day, then fetches
 *                           today's data (mode=1) and merges it in.
 *
 * Required env: BLOB_READ_WRITE_TOKEN
 */

import { put, list } from '@vercel/blob'

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required')

const OREF_CITIES_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx'
const OREF_HISTORY_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'
const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/',
  Origin: 'https://www.oref.org.il',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}
const CONCURRENCY = 150

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Current date in Asia/Jerusalem timezone as "YYYY-MM-DD" */
function todayKey() {
  // 'sv' locale uses ISO date format YYYY-MM-DD
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

async function orefGet(url) {
  const res = await fetch(url, { headers: OREF_HEADERS, cache: 'no-store' })
  const text = await res.text()
  return text.trim() ? JSON.parse(text) : []
}

async function fetchCityLabels(lang) {
  const cities = await orefGet(`${OREF_CITIES_BASE}?lang=${lang}`)
  return [...new Set(
    cities
      .filter(c => !c.label.includes('כל האזורים') && !c.label.includes('כל - האזורים'))
      .map(c => c.label)
  )].sort()
}

/**
 * Fetches per-city alerts and returns a {dateKey: count} map.
 * alertDate from oref is already in Israel time: "YYYY-MM-DD HH:MM:SS"
 */
async function fetchCityDays(cityLabel, lang, mode) {
  const url = new URL(OREF_HISTORY_BASE)
  url.searchParams.set('lang', lang)
  url.searchParams.set('mode', String(mode))
  url.searchParams.set('city_0', cityLabel)
  const alerts = await orefGet(url.toString())
  const days = {}
  for (const alert of alerts) {
    const dk = alert.alertDate.slice(0, 10) // "YYYY-MM-DD"
    days[dk] = (days[dk] ?? 0) + 1
  }
  return days
}

/** Runs fetchCityDays for all labels with up to CONCURRENCY concurrent workers */
async function fetchAllCityDays(cityLabels, lang, mode) {
  const result = {}
  let index = 0

  async function worker() {
    while (true) {
      const i = index++
      if (i >= cityLabels.length) break
      try {
        const days = await fetchCityDays(cityLabels[i], lang, mode)
        if (Object.keys(days).length > 0) result[cityLabels[i]] = days
      } catch (err) {
        console.error(`  [${lang}] Error for "${cityLabels[i]}": ${err.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cityLabels.length) }, worker))
  return result
}

/** Downloads an existing blob by pathname, returns parsed JSON or null if not found */
async function downloadBlob(pathname) {
  const { blobs } = await list({ prefix: pathname, token: BLOB_TOKEN })
  const match = blobs.find(b => b.pathname === pathname)
  if (!match) return null
  const res = await fetch(match.url)
  if (!res.ok) return null
  return res.json()
}

/** Uploads data as a public blob with a stable URL (no random suffix) */
async function uploadBlob(pathname, data) {
  const result = await put(pathname, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    token: BLOB_TOKEN,
  })
  console.log(`  Uploaded: ${result.url}`)
}

/**
 * Archives the existing blob once per day.
 * Archive pathname: archive/{YYYY-MM-DDTHH-MM-SSZ}-city-rankings-{lang}.json
 * Skips if an archive for today already exists.
 */
async function archiveIfNeeded(lang, existingBlob) {
  const today = todayKey()
  const { blobs } = await list({ prefix: `archive/${today}`, token: BLOB_TOKEN })
  const alreadyArchived = blobs.some(b => b.pathname.includes(`city-rankings-${lang}.json`))
  if (alreadyArchived) {
    console.log(`  [${lang}] Archive for today already exists — skipping`)
    return
  }
  // Use the blob's own generated timestamp as prefix (YYYY-MM-DDTHH-MM-SSZ)
  const ts = existingBlob.generated
    .replace(/\.\d+Z$/, 'Z')  // remove ms: "2026-03-08T12:34:00.000Z" → "2026-03-08T12:34:00Z"
    .replace(/:/g, '-')         // colons → dashes: "2026-03-08T12-34-00Z"
  const archivePath = `archive/${ts}-city-rankings-${lang}.json`
  await uploadBlob(archivePath, existingBlob)
  console.log(`  [${lang}] Archived as ${archivePath}`)
}

// ─── Per-language processor ───────────────────────────────────────────────────

async function processLang(lang) {
  console.log(`\n[${lang}] Starting...`)
  const blobName = `city-rankings-${lang}.json`
  const cityLabels = await fetchCityLabels(lang)
  console.log(`  [${lang}] ${cityLabels.length} cities`)

  const existing = await downloadBlob(blobName)

  if (!existing) {
    // ── Cold start ──
    console.log(`  [${lang}] Cold start — fetching 30-day history (mode=3)`)
    const cityDaysMap = await fetchAllCityDays(cityLabels, lang, 3)
    const cities = Object.entries(cityDaysMap).map(([label, days]) => ({ label, days }))
    console.log(`  [${lang}] ${cities.length} cities with alerts`)
    return { generated: new Date().toISOString(), cities }
  }

  // ── Delta run ──
  await archiveIfNeeded(lang, existing)
  console.log(`  [${lang}] Delta run — fetching today's data (mode=1)`)
  const todayDaysMap = await fetchAllCityDays(cityLabels, lang, 1)
  console.log(`  [${lang}] ${Object.keys(todayDaysMap).length} cities with alerts today`)

  // Merge: start from existing blob, overwrite today's counts
  const cityMap = new Map(
    existing.cities.map(c => [c.label, { label: c.label, days: { ...c.days } }])
  )
  for (const [label, days] of Object.entries(todayDaysMap)) {
    const entry = cityMap.get(label) ?? { label, days: {} }
    // days is keyed by date; for mode=1 all entries should be today's date
    for (const [dk, count] of Object.entries(days)) {
      entry.days[dk] = count
    }
    cityMap.set(label, entry)
  }

  const cities = Array.from(cityMap.values())
  console.log(`  [${lang}] Total ${cities.length} cities in blob`)
  return { generated: new Date().toISOString(), cities }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('Precomputing city rankings...')
const [dataHe, dataEn] = await Promise.all([processLang('he'), processLang('en')])

console.log('\nUploading blobs...')
await Promise.all([
  uploadBlob('city-rankings-he.json', dataHe),
  uploadBlob('city-rankings-en.json', dataEn),
])

console.log('\nDone!')
```

**Step 2: Verify script runs without errors (requires `BLOB_READ_WRITE_TOKEN`)**

> Note: Skip this step if the Vercel Blob store isn't set up yet — that's OK at this stage.
> The workflow in Task 3 will be the real test. However if the token is available locally:

```bash
BLOB_READ_WRITE_TOKEN=your_token node scripts/precompute-city-rankings.mjs
```

Expected: Prints cities fetched and "Done!".

**Step 3: Commit**

```bash
git add scripts/precompute-city-rankings.mjs
git commit -m "feat: add precompute city rankings script"
```

---

## Task 3: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/precompute-city-rankings.yml`

**Step 1: Create the `.github/workflows/` directory if needed**

```bash
mkdir -p .github/workflows
```

**Step 2: Create the workflow file**

`.github/workflows/precompute-city-rankings.yml`:

```yaml
name: Precompute City Rankings

on:
  schedule:
    - cron: '*/30 * * * *'   # every 30 minutes — ~1,440 min/month, within 2,000 free tier
  workflow_dispatch:           # manual trigger for testing

jobs:
  precompute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: node scripts/precompute-city-rankings.mjs
        env:
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
```

**Step 3: Commit**

```bash
git add .github/workflows/precompute-city-rankings.yml
git commit -m "feat: add GitHub Actions workflow for city rankings precomputation"
```

---

## Task 4: Create `hooks/useCityRankings.ts`

This hook replaces `useAllCitiesAlerts`. It fetches the precomputed blob once per language (cached forever), computes `CityCount[]` for the requested date range, and handles fetch errors gracefully.

**Files:**
- Create: `hooks/useCityRankings.ts`
- Create: `hooks/__tests__/useCityRankings.test.ts`

**Step 1: Write the failing test**

`hooks/__tests__/useCityRankings.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCityRankings } from '../useCityRankings'

// Mock env var
process.env.NEXT_PUBLIC_BLOB_BASE_URL = 'https://test.blob.example.com'

const MOCK_BLOB = {
  generated: '2026-03-08T10:00:00Z',
  cities: [
    { label: 'תל אביב', days: { '2026-03-08': 5, '2026-03-07': 3, '2026-03-01': 2 } },
    { label: 'חיפה',    days: { '2026-03-08': 1 } },
    { label: 'ירושלים', days: { '2026-02-01': 10 } }, // outside 7d window
  ],
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCityRankings', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_BLOB),
    } as Response)
  })

  it('fetches blob for the given language', async () => {
    const { result } = renderHook(() => useCityRankings('he', '7d'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('city-rankings-he.json')
    )
  })

  it('sums alert counts for the last 7 days', async () => {
    const { result } = renderHook(() => useCityRankings('he', '7d'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const telAviv = result.current.cities.find(c => c.label === 'תל אביב')
    expect(telAviv?.count).toBe(8)  // 5 + 3 (dates within last 7 days)
  })

  it('omits cities with zero alerts in the period', async () => {
    const { result } = renderHook(() => useCityRankings('he', '7d'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const yerushalayim = result.current.cities.find(c => c.label === 'ירושלים')
    expect(yerushalayim).toBeUndefined()
  })

  it('sums only today for dateRange=today', async () => {
    const { result } = renderHook(() => useCityRankings('he', 'today'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const telAviv = result.current.cities.find(c => c.label === 'תל אביב')
    // '2026-03-08' is today in the test (mocked date context)
    expect(telAviv?.count).toBeGreaterThan(0)
  })

  it('returns generated timestamp from blob', async () => {
    const { result } = renderHook(() => useCityRankings('he', '7d'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.generated).toBe('2026-03-08T10:00:00Z')
  })

  it('returns error message on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useCityRankings('he', '7d'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toContain('Network error')
    expect(result.current.cities).toEqual([])
  })
})
```

**Step 2: Run the test — confirm it fails**

```bash
npm test -- hooks/__tests__/useCityRankings.test.ts
```

Expected: FAIL — `useCityRankings` does not exist yet.

**Step 3: Implement `hooks/useCityRankings.ts`**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export interface CityCount {
  label: string
  count: number
}

interface BlobCity {
  label: string
  days: Record<string, number>  // { "YYYY-MM-DD": count }
}

interface BlobData {
  generated: string
  cities: BlobCity[]
}

/** Returns YYYY-MM-DD in Asia/Jerusalem timezone */
function toISODateIsrael(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

/** Subtracts `n` days from a YYYY-MM-DD string */
function subtractDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function computeCounts(blob: BlobData, dateRange: 'today' | '7d' | '30d'): CityCount[] {
  const today = toISODateIsrael()
  const cutoff =
    dateRange === 'today' ? today :
    dateRange === '7d'    ? subtractDays(today, 6) :
                            subtractDays(today, 29)

  return blob.cities
    .map((city) => {
      const count = Object.entries(city.days)
        .filter(([dk]) => dk >= cutoff && dk <= today)
        .reduce((sum, [, n]) => sum + n, 0)
      return { label: city.label, count }
    })
    .filter((c) => c.count > 0)
}

export function useCityRankings(lang: 'he' | 'en', dateRange: 'today' | '7d' | '30d') {
  const baseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL

  const { data: blob, isLoading, error } = useQuery<BlobData>({
    queryKey: ['cityRankings', lang],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/city-rankings-${lang}.json`)
      if (!res.ok) throw new Error(`Failed to fetch city rankings: ${res.status}`)
      return res.json()
    },
    staleTime: Infinity,
    enabled: !!baseUrl,
  })

  const cities = useMemo(() => {
    if (!blob) return []
    return computeCounts(blob, dateRange)
  }, [blob, dateRange])

  return {
    cities,
    generated: blob?.generated ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
```

**Step 4: Run the test — confirm it passes**

```bash
npm test -- hooks/__tests__/useCityRankings.test.ts
```

Expected: PASS (all 6 tests green).

**Step 5: Commit**

```bash
git add hooks/useCityRankings.ts hooks/__tests__/useCityRankings.test.ts
git commit -m "feat: add useCityRankings hook"
```

---

## Task 5: Update `CityRankingChart.tsx`

Replace the progress-based loading UI with a simple loading state. Add "Last updated" label. Handle searched cities with zero alerts.

**Files:**
- Modify: `components/CityRankingChart.tsx`

**Step 1: Rewrite `CityRankingChart.tsx`**

Replace the entire file content:

```tsx
'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer,
} from 'recharts'
import type { CityCount } from '@/hooks/useCityRankings'
import { CityCombobox } from '@/components/FilterBar'
import { useI18n } from '@/lib/i18n'

interface CityRankingChartProps {
  cities: CityCount[]
  loading: boolean
  error: string | null
  generated: string | null
  cityLabels: string[]
}

const LIMIT = 50

/** Formats a UTC ISO timestamp as "DD/MM/YYYY, HH:MM" in Asia/Jerusalem time */
function formatGenerated(generated: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(generated))
}

export function CityRankingChart({ cities, loading, error, generated, cityLabels }: CityRankingChartProps) {
  const { t } = useI18n()
  const [sortDesc, setSortDesc] = useState(true)
  const [cityLabel, setCityLabel] = useState('')

  // Rank is always based on most-alerts-first order (#1 = most alerts)
  const rankMap = new Map(
    [...cities].sort((a, b) => b.count - a.count).map((city, i) => [city.label, i + 1])
  )

  // If user searches a city not in the blob, show a synthetic zero-alert entry
  const searchedCity: CityCount | null = cityLabel
    ? (cities.find(c => c.label === cityLabel) ?? { label: cityLabel, count: 0 })
    : null

  const displayData = searchedCity
    ? [{
        ...searchedCity,
        displayLabel: `#${rankMap.get(searchedCity.label) ?? '—'}  ${searchedCity.label}`,
      }]
    : [...cities]
        .sort((a, b) => sortDesc ? b.count - a.count : a.count - b.count)
        .slice(0, LIMIT)
        .map((city) => ({
          ...city,
          displayLabel: `#${rankMap.get(city.label) ?? '?'}  ${city.label}`,
        }))

  const chartHeight = Math.max(200, displayData.length * 22 + 60)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">{t('chartByCityTitle')}</h2>
          {generated && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('cityRankingUpdated', { datetime: formatGenerated(generated) })}
            </p>
          )}
        </div>
        {!cityLabel && (
          <button
            onClick={() => setSortDesc((d) => !d)}
            disabled={loading || cities.length === 0}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sortDesc ? t('sortLeastFirst') : t('sortMostFirst')}
          </button>
        )}
      </div>

      {/* Subtitle: top/bottom indicator or rank of searched city */}
      <div className="mb-3">
        {!cityLabel && !loading && cities.length > LIMIT && (
          <p className="text-xs text-gray-400">
            {sortDesc
              ? t('cityRankingTop', { n: String(LIMIT), total: String(cities.length) })
              : t('cityRankingBottom', { n: String(LIMIT), total: String(cities.length) })}
          </p>
        )}
        {cityLabel && searchedCity && searchedCity.count > 0 && (
          <p className="text-xs text-gray-400">
            {t('cityRankSearchInfo', {
              rank: String(rankMap.get(cityLabel) ?? '?'),
              total: String(cities.length),
            })}
          </p>
        )}
        {cityLabel && searchedCity && searchedCity.count === 0 && (
          <p className="text-xs text-gray-400">{t('cityRankingNoAlerts')}</p>
        )}
      </div>

      {/* City search */}
      <div className="mb-3">
        <CityCombobox
          value={cityLabel}
          onChange={setCityLabel}
          options={cityLabels}
          placeholder={t('filterCity')}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-sm text-gray-400 text-center py-8 animate-pulse">{t('loading')}</div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-sm text-red-500 text-center py-8">{t('errorLoad')}</div>
      )}

      {/* Empty state */}
      {!loading && !error && displayData.length === 0 && !cityLabel && (
        <div className="text-sm text-gray-400 text-center py-8">{t('cityRankingEmpty')}</div>
      )}

      {/* Chart */}
      {!loading && !error && displayData.length > 0 && (
        <div dir="ltr" style={{ maxHeight: 600, overflowY: 'auto' }}>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayData}
                layout="vertical"
                margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                />
                <YAxis
                  type="category"
                  dataKey="displayLabel"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  width={200}
                />
                <Bar
                  dataKey="count"
                  fill="#EF4444"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={16}
                  isAnimationActive={true}
                  animationDuration={400}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    style={{ fontSize: 11, fill: '#6B7280' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/CityRankingChart.tsx
git commit -m "feat: update CityRankingChart for precomputed blob"
```

---

## Task 6: Update `app/page.tsx`

Swap `useAllCitiesAlerts` for `useCityRankings` and pass the new props to `CityRankingChart`.

**Files:**
- Modify: `app/page.tsx`

**Step 1: Replace import and hook call**

In `app/page.tsx`:

1. Remove line:
```ts
import { useAllCitiesAlerts } from '@/hooks/useAllCitiesAlerts'
```

2. Add line:
```ts
import { useCityRankings } from '@/hooks/useCityRankings'
```

3. Replace:
```ts
const { cities: rankedCities, loaded: rankLoaded, total: rankTotal, done: rankDone } =
  useAllCitiesAlerts(cityLabels, lang)
```

With:
```ts
const { cities: rankedCities, generated: rankGenerated, loading: rankLoading, error: rankError } =
  useCityRankings(lang, '7d')
```

4. Replace the `<CityRankingChart>` JSX:
```tsx
<CityRankingChart
  cities={rankedCities}
  loaded={rankLoaded}
  total={rankTotal}
  done={rankDone}
  cityLabels={cityLabels}
/>
```

With:
```tsx
<CityRankingChart
  cities={rankedCities}
  loading={rankLoading}
  error={rankError}
  generated={rankGenerated}
  cityLabels={cityLabels}
/>
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Run the dev server and verify the chart renders**

```bash
npm run dev
```

Open the app — the CityRankingChart should show "Loading..." briefly then render from the blob. If `NEXT_PUBLIC_BLOB_BASE_URL` is not set, the chart stays empty (loading never resolves because `enabled: false` in the query). That's correct behavior until the blob is populated.

**Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire useCityRankings into page"
```

---

## Task 7: Add translation keys

**Files:**
- Modify: `lib/translations/en.json`
- Modify: `lib/translations/he.json`

**Step 1: Add keys to `lib/translations/en.json`**

Add these two keys after `"cityRankingEmpty"`:

```json
"cityRankingUpdated": "Updated {datetime}",
"cityRankingNoAlerts": "No alerts in this period"
```

**Step 2: Add keys to `lib/translations/he.json`**

Add these two keys after `"cityRankingEmpty"`:

```json
"cityRankingUpdated": "עודכן {datetime}",
"cityRankingNoAlerts": "אין התרעות בתקופה זו"
```

**Step 3: Run the test suite to verify no regressions**

```bash
npm test
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add lib/translations/en.json lib/translations/he.json
git commit -m "feat: add cityRankingUpdated and cityRankingNoAlerts translation keys"
```

---

## Setup Checklist (after implementation)

These steps require manual action in external services:

1. **Create Vercel Blob store:**
   - Vercel dashboard → project → **Storage** tab → **Connect Store** → **Blob** → Create
   - Copy `BLOB_READ_WRITE_TOKEN` from the store's `.env.local` tab

2. **Add GitHub secret:**
   - Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `BLOB_READ_WRITE_TOKEN`, Value: token from step 1

3. **Add Vercel env var:**
   - Vercel dashboard → project → **Settings** → **Environment Variables**
   - Name: `NEXT_PUBLIC_BLOB_BASE_URL`, Value: `https://xxxx.public.blob.vercel-storage.com`
   - The base URL is shown in the Vercel Blob store page

4. **Run the workflow manually** to populate the blobs:
   - GitHub → repo → **Actions** → **Precompute City Rankings** → **Run workflow**

5. **Verify blobs exist:**
   - Vercel dashboard → Storage → Blob → should show `city-rankings-he.json` and `city-rankings-en.json`

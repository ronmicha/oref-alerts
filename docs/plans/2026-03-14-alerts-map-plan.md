# Alerts Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

---

## Goal

Add an interactive Map tab to the oref-alerts Next.js app. The map has two modes: Real-time (Oref `mode=1`, polled every 30s, CircleMarkers per alert type) and History (TzevaAdom heatmap, circle size+color by count, date range filter). The existing Charts tab content is unchanged; a bottom tab bar provides navigation between the two tabs.

## Architecture

- New bottom `<nav>` tab bar in `app/page.tsx` with `activeTab: 'charts' | 'map'` state.
- All Leaflet/react-leaflet components dynamically imported (`next/dynamic({ ssr: false })`).
- New hook `hooks/useRealtimeAlerts.ts` wraps React Query (`useQuery`, 30s refetch interval).
- Static `public/cities-geo.json` (~1,300 entries) produced by one-time script.
- `lib/citiesGeo.ts` provides `getCityCoords(name)` lookup (Hebrew first, then English).
- `components/MapView.tsx` — mode toggle + dynamic import of `RealtimeMap` or `HistoryMap`.
- `components/RealtimeMap.tsx` — Leaflet map, 30s polling, concentric-ring markers.
- `components/HistoryMap.tsx` — Leaflet map, heatmap, date range selector.

## Tech Stack additions

- `leaflet` — core mapping library
- `react-leaflet` — React bindings
- `@types/leaflet` — TypeScript types (dev)
- `tsx` (already available via `ts-node`) — runs geocoding script

---

## Task 1 — Install leaflet, react-leaflet, @types/leaflet

**Files:** `package.json`, `package-lock.json` (auto-updated)

### Steps

1. Run the install command from the project root:

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npm install leaflet react-leaflet
npm install --save-dev @types/leaflet
```

Expected output: lines like `added N packages` with no peer-dependency errors. React 19 is supported by react-leaflet v4+.

2. Verify installed versions:

```bash
node -e "const p = require('./node_modules/react-leaflet/package.json'); console.log(p.version)"
node -e "const p = require('./node_modules/leaflet/package.json'); console.log(p.version)"
```

Expected: react-leaflet `4.x`, leaflet `1.9.x`.

3. Confirm TypeScript types are present:

```bash
ls node_modules/@types/leaflet/index.d.ts
```

### Commit

```
git add package.json package-lock.json
git commit -m "feat: install leaflet, react-leaflet, @types/leaflet"
```

---

## Task 2 — Add i18n strings

**Files to modify:**
- `lib/translations/he.json`
- `lib/translations/en.json`

### Steps

In `lib/translations/he.json`, add these five keys at the top level (before the `"categories"` key, after `"langToggle"`):

```json
"tabCharts": "גרפים",
"tabMap": "מפה",
"mapModeRealtime": "זמן אמת",
"mapModeHistory": "היסטוריה",
"mapLastUpdated": "עדכון אחרון"
```

In `lib/translations/en.json`, add the same five keys:

```json
"tabCharts": "Charts",
"tabMap": "Map",
"mapModeRealtime": "Real-time",
"mapModeHistory": "History",
"mapLastUpdated": "Last updated"
```

### Verification

`lib/i18n.tsx` uses `typeof he` as the `Translations` type, so TypeScript will pick up the new keys automatically. Run:

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npx tsc --noEmit
```

Expected: no errors.

### Commit

```
git add lib/translations/he.json lib/translations/en.json
git commit -m "feat(i18n): add tab and map mode translation keys"
```

---

## Task 3 — Generate public/cities-geo.json

**Files to create:**
- `scripts/generate-cities-geo.ts`
- `public/cities-geo.json` (output of the script)

### 3a — Create the script

Create `scripts/generate-cities-geo.ts`:

```typescript
/**
 * One-time geocoding script.
 * Fetches all Israeli cities from Oref, geocodes each via Nominatim, writes public/cities-geo.json.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json -e "require('./scripts/generate-cities-geo.ts')"
 *   OR (if tsx is available):
 *   npx tsx scripts/generate-cities-geo.ts
 *
 * Nominatim rate limit: 1 req/sec — the script respects this automatically.
 * On first run expect ~20-30 minutes for ~1,300 cities.
 */

import * as fs from 'fs'
import * as path from 'path'

const OREF_PROXY = process.env.NEXT_PUBLIC_OREF_PROXY ?? 'https://www.oref.org.il/warningMessages/alert'
// Direct Oref cities endpoint (bypass proxy for script usage)
const OREF_CITIES_HE = 'https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json'

// We call the cities API directly (not through the app proxy)
const CITIES_URL_HE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=HE'
const CITIES_URL_EN = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=EN'

interface OrefCity {
  label: string
  value: string
  id: string
  areaid: number
  color: string
  migun_time: number
  rashut: string
  label_he: string
}

interface CityGeoEntry {
  label_he: string
  label_en: string
  lat: number
  lng: number
}

async function fetchCities(lang: 'HE' | 'EN'): Promise<OrefCity[]> {
  const url = lang === 'HE' ? CITIES_URL_HE : CITIES_URL_EN
  const res = await fetch(url, {
    headers: { 'Referer': 'https://www.oref.org.il/', 'User-Agent': 'oref-alerts-geocoder/1.0' },
  })
  if (!res.ok) throw new Error(`Failed to fetch cities (${lang}): ${res.status}`)
  return res.json()
}

async function geocode(name: string, lang: 'he' | 'en'): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${name},Israel`)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=${lang}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'oref-alerts-geocoder/1.0 (https://github.com/your-repo)',
      'Accept-Language': lang,
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data || data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('Fetching Hebrew city list...')
  const heCities = await fetchCities('HE')
  console.log(`Got ${heCities.length} Hebrew cities`)

  console.log('Fetching English city list...')
  const enCities = await fetchCities('EN')
  console.log(`Got ${enCities.length} English cities`)

  // Build id → English label map
  const enById = new Map<string, string>(enCities.map((c) => [c.id, c.label]))

  const results: CityGeoEntry[] = []
  const failed: string[] = []

  for (let i = 0; i < heCities.length; i++) {
    const city = heCities[i]
    const labelEn = enById.get(city.id) ?? city.label_he
    const labelHe = city.label

    process.stdout.write(`[${i + 1}/${heCities.length}] Geocoding: ${labelHe} ... `)

    // Try Hebrew name first
    let coords = await geocode(labelHe, 'he')
    await sleep(1100) // Nominatim rate limit: 1 req/sec

    if (!coords && labelEn !== labelHe) {
      coords = await geocode(labelEn, 'en')
      await sleep(1100)
    }

    if (coords) {
      results.push({ label_he: labelHe, label_en: labelEn, lat: coords.lat, lng: coords.lng })
      console.log(`OK (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`)
    } else {
      failed.push(`${labelHe} / ${labelEn}`)
      console.log('FAILED')
    }
  }

  const outPath = path.join(process.cwd(), 'public', 'cities-geo.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')

  console.log(`\nWrote ${results.length} entries to ${outPath}`)
  if (failed.length > 0) {
    console.warn(`\nFailed to geocode ${failed.length} cities:`)
    failed.forEach((f) => console.warn('  -', f))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
```

### 3b — Run the script

The script takes ~20-30 minutes for ~1,300 cities due to Nominatim's 1 req/sec rate limit.

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npx tsx scripts/generate-cities-geo.ts
```

If `tsx` is not available as an npx binary (it is listed as a dependency of ts-node in the project), use:

```bash
npx ts-node --esm scripts/generate-cities-geo.ts
```

Or add `tsx` as a dev dependency first:

```bash
npm install --save-dev tsx
npx tsx scripts/generate-cities-geo.ts
```

Expected terminal output:
```
Fetching Hebrew city list...
Got 1312 Hebrew cities
Fetching English city list...
Got 1312 English cities
[1/1312] Geocoding: אבו סנאן ... OK (32.9892, 35.1542)
[2/1312] Geocoding: אבו עמאר ... OK (31.2345, 34.5678)
...
Wrote 1280 entries to /Users/ronmichaeli/dev/oref-alerts/public/cities-geo.json
Failed to geocode 32 cities:
  - אבו קורינאת (ה) / Abu Qureinat (H)
  ...
```

The ~32 failed entries are typically very small localities with no Nominatim entry. They will not appear on the map, which is acceptable.

### 3c — Verify the JSON

```bash
node -e "
  const data = require('./public/cities-geo.json');
  console.log('Total entries:', data.length);
  console.log('Sample:', JSON.stringify(data[0], null, 2));
  const invalid = data.filter(d => !d.lat || !d.lng || isNaN(d.lat) || isNaN(d.lng));
  console.log('Invalid entries:', invalid.length);
"
```

Expected:
```
Total entries: 1280   (approximate)
Sample: {
  "label_he": "אבו סנאן",
  "label_en": "Abu Snan",
  "lat": 32.9892,
  "lng": 35.1542
}
Invalid entries: 0
```

### Commit

```
git add scripts/generate-cities-geo.ts public/cities-geo.json
git commit -m "feat: add city geocoding script and generated cities-geo.json"
```

---

## Task 4 — Add lib/citiesGeo.ts

**Files to create:**
- `lib/citiesGeo.ts`

### Steps

Create `lib/citiesGeo.ts`:

```typescript
import citiesGeoRaw from '@/public/cities-geo.json'

export interface CityGeoEntry {
  label_he: string
  label_en: string
  lat: number
  lng: number
}

const citiesGeo: CityGeoEntry[] = citiesGeoRaw as CityGeoEntry[]

// Build lookup maps for O(1) access
const byHe = new Map<string, CityGeoEntry>()
const byEn = new Map<string, CityGeoEntry>()

for (const entry of citiesGeo) {
  byHe.set(entry.label_he, entry)
  byEn.set(entry.label_en, entry)
}

/**
 * Returns lat/lng for a city by name.
 * Tries Hebrew name first (exact match), then English name (exact match).
 * Returns null if not found.
 */
export function getCityCoords(name: string): { lat: number; lng: number } | null {
  const entry = byHe.get(name) ?? byEn.get(name)
  return entry ? { lat: entry.lat, lng: entry.lng } : null
}

export { citiesGeo }
```

**Note on `resolveJsonModule`:** `tsconfig.json` already has `"resolveJsonModule": true`, so the JSON import works without any config changes. The `@/public/cities-geo.json` path resolves via the `@/*` alias in `tsconfig.json` to `./public/cities-geo.json`.

### Verification

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npx tsc --noEmit
```

Expected: no errors.

Quick smoke test:

```bash
node -e "
  // Quick compile check — verify the module resolves correctly
  const path = require('path');
  const data = require('./public/cities-geo.json');
  const byHe = new Map(data.map(e => [e.label_he, e]));
  const result = byHe.get('תל אביב - יפו') ?? byHe.get('תל אביב');
  console.log('Tel Aviv lookup:', result ? 'FOUND' : 'NOT FOUND', result);
"
```

### Commit

```
git add lib/citiesGeo.ts
git commit -m "feat: add citiesGeo lookup helper"
```

---

## Task 5 — Add scripts/validate-cities-geo.ts and run it

**Files to create:**
- `scripts/validate-cities-geo.ts`

### Steps

Create `scripts/validate-cities-geo.ts`:

```typescript
/**
 * Validation script — run once after generating cities-geo.json.
 * Reports city names that appear in Oref or TzevaAdom data but are missing from the geo file.
 *
 * Usage:
 *   npx tsx scripts/validate-cities-geo.ts
 */

import { getCityCoords } from '../lib/citiesGeo'

const CITIES_URL_HE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=HE'
const TZEVAADOM_URL = 'https://www.tzevaadom.co.il/static/notifications.json'

interface OrefCity { label: string; id: string }
type TzevaadomEntry = [number, number, string[], number]

async function main() {
  console.log('Fetching Oref city list...')
  const orefRes = await fetch(CITIES_URL_HE, {
    headers: { Referer: 'https://www.oref.org.il/', 'User-Agent': 'oref-alerts-validator/1.0' },
  })
  if (!orefRes.ok) throw new Error(`Oref cities fetch failed: ${orefRes.status}`)
  const orefCities: OrefCity[] = await orefRes.json()
  console.log(`Oref: ${orefCities.length} cities`)

  console.log('Fetching TzevaAdom data...')
  const tzRes = await fetch(TZEVAADOM_URL, { headers: { 'User-Agent': 'oref-alerts-validator/1.0' } })
  if (!tzRes.ok) throw new Error(`TzevaAdom fetch failed: ${tzRes.status}`)
  const tzRaw: TzevaadomEntry[] = await tzRes.json()

  const tzCitySet = new Set<string>()
  for (const [, , cities] of tzRaw) {
    for (const c of cities) tzCitySet.add(c)
  }
  console.log(`TzevaAdom: ${tzCitySet.size} unique city names`)

  const missingOref: string[] = []
  for (const city of orefCities) {
    if (!getCityCoords(city.label)) missingOref.push(city.label)
  }

  const missingTz: string[] = []
  for (const name of tzCitySet) {
    if (!getCityCoords(name)) missingTz.push(name)
  }

  if (missingOref.length === 0) {
    console.log('\nAll Oref cities found in geo file.')
  } else {
    console.warn(`\nMissing from geo file (Oref) — ${missingOref.length} cities:`)
    missingOref.forEach((c) => console.warn('  -', c))
  }

  if (missingTz.length === 0) {
    console.log('\nAll TzevaAdom cities found in geo file.')
  } else {
    console.warn(`\nMissing from geo file (TzevaAdom) — ${missingTz.length} cities:`)
    missingTz.forEach((c) => console.warn('  -', c))
  }

  const totalMissing = new Set([...missingOref, ...missingTz]).size
  console.log(`\nSummary: ${totalMissing} city names without coordinates.`)
  console.log('These cities will not appear on the map — this is acceptable for small localities.')
}

main().catch((e) => { console.error(e); process.exit(1) })
```

### Run it

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npx tsx scripts/validate-cities-geo.ts
```

Expected output (numbers will vary):

```
Fetching Oref city list...
Oref: 1312 cities
Fetching TzevaAdom data...
TzevaAdom: 890 unique city names

Missing from geo file (Oref) — 32 cities:
  - אבו קורינאת (ה)
  ...

All TzevaAdom cities found in geo file.

Summary: 32 city names without coordinates.
These cities will not appear on the map — this is acceptable for small localities.
```

If the missing count is unexpectedly high (>100 major cities like Tel Aviv or Jerusalem missing), re-examine the geocoding script output and potentially re-run for the failed entries only.

### Commit

```
git add scripts/validate-cities-geo.ts
git commit -m "feat: add cities-geo validation script"
```

---

## Task 6 — Add bottom tab bar to app/page.tsx (Charts tab + Map placeholder)

**Files to modify:**
- `app/page.tsx`

### Steps

The goal of this task is to introduce the tab bar infrastructure with the Map tab showing a `<div>Map coming soon</div>` placeholder. The full `MapView` component is wired in Task 11. This separation keeps each commit small and testable.

The changes to `app/page.tsx` are:

1. Add `activeTab` state.
2. Wrap all existing JSX (header + main + footer) in a conditional `activeTab === 'charts'` block.
3. Add a `activeTab === 'map'` block with placeholder.
4. Add the fixed bottom `<nav>` tab bar.
5. Add `paddingBottom` to the existing content so it doesn't hide behind the tab bar.

Full updated `app/page.tsx`:

```tsx
'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useTzevaadomAlerts } from '@/hooks/useTzevaadomAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { FilterBar } from '@/components/FilterBar'
import { ByDayChart } from '@/components/ByDayChart'
import { TimeOfDayChart } from '@/components/TimeOfDayChart'
import { useCityRankings } from '@/hooks/useCityRankings'
import { CityRankingChart } from '@/components/CityRankingChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { DonateFAB } from '@/components/DonateFAB'
import { RefreshCw, Loader2 } from 'lucide-react'
import { filterAlerts, aggregateByDay, aggregateByTimeOfDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import { getPresetDateRange } from '@/lib/dateRange'
import type { DateRangeOption } from '@/types/oref'

// Maps UI date range to oref API mode: 1=day, 2=week, 3=month
const API_MODE: Record<Exclude<DateRangeOption, 'custom'>, 1 | 2 | 3> = {
  '24h': 1,
  '7d':  2,
  '30d': 3,
}

function formatDate(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.slice(0, 10).split('-')
  return `${dd}/${mm}/${yyyy}`
}

// TAB BAR HEIGHT used for padding — keep in sync with the nav height below
const TAB_BAR_HEIGHT = 56

export default function Home() {
  const { t, lang } = useI18n()

  const [activeTab, setActiveTab] = useState<'charts' | 'map'>('charts')

  const [dateRange, setDateRange] = useState<DateRangeOption>('24h')
  const [cityLabel, setCityLabel] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const isCustom = dateRange === 'custom'

  // Reset content filters when language changes (city names change; category IDs become stale in context)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setCityLabel('')
    setCategoryId(undefined)
  }, [lang])

  // Compute date range first — needed to evaluate isAtLimit correctly
  const { startDate, endDate } = useMemo(() => {
    if (isCustom) return { startDate: customFrom, endDate: customTo }
    return getPresetDateRange(dateRange as Exclude<DateRangeOption, 'custom'>)
  }, [isCustom, customFrom, customTo, dateRange])

  const { alerts: orefAlerts, loading: orefLoading, error: orefError, retry } = useAlerts({
    mode: isCustom ? 1 : API_MODE[dateRange as Exclude<DateRangeOption, 'custom'>],
    city: cityLabel || undefined,
    lang,
    enabled: !isCustom,
  })

  const orefInDateRange = useMemo(
    () => startDate && endDate ? filterAlerts(orefAlerts, { startDate, endDate }) : orefAlerts,
    [orefAlerts, startDate, endDate],
  )
  const isAtLimit = !isCustom && !orefLoading && orefInDateRange.length === 3000
  const useTzevaadom = isCustom || isAtLimit

  const { alerts: tzevaadomAlerts, loading: tzevaadomLoading, error: tzevaadomError, refetch: tzevaadomRefetch } = useTzevaadomAlerts({
    enabled: useTzevaadom,
  })

  const alerts = useTzevaadom ? tzevaadomAlerts : orefAlerts
  const alertsLoading = isCustom ? tzevaadomLoading : isAtLimit ? tzevaadomLoading : orefLoading
  const alertsError = useTzevaadom ? tzevaadomError : orefError

  const { cities, cityLabels, loading: citiesLoading } = useCities(lang)
  const { categories, loading: categoriesLoading } = useCategories()
  const { rankFromTs, rankToTs } = useMemo(() => {
    const fromStr = startDate ? (startDate.includes('T') ? startDate : startDate + 'T00:00') : null
    const toStr = endDate ? (endDate.includes('T') ? endDate : endDate + 'T23:59:59') : null
    return {
      rankFromTs: fromStr ? new Date(fromStr).getTime() / 1000 : 0,
      rankToTs: toStr ? new Date(toStr).getTime() / 1000 : Date.now() / 1000,
    }
  }, [startDate, endDate])

  const { cities: rankedCities, loading: rankLoading, error: rankError, refetch: rankRefetch } =
    useCityRankings(lang, rankFromTs, rankToTs)
  const ALLOWED_CATEGORY_SLUGS = ['missilealert', 'uav', 'flash', 'update']
  const filterableCategories = categories.filter((c) => ALLOWED_CATEGORY_SLUGS.includes(c.category))

  const enToHe = useMemo(
    () => lang === 'en' ? new Map(cities.map((c) => [c.label, c.label_he])) : null,
    [cities, lang],
  )
  const effectiveCityLabel = useTzevaadom && lang === 'en' && cityLabel && enToHe
    ? (enToHe.get(cityLabel) ?? cityLabel)
    : cityLabel

  const filteredAlerts = useMemo(
    () => filterAlerts(alerts, {
      cityLabel: effectiveCityLabel || undefined,
      categoryId,
      startDate,
      endDate,
    }),
    [alerts, effectiveCityLabel, categoryId, startDate, endDate]
  )

  const chartData = useMemo(
    () => startDate && endDate
      ? aggregateByDay(filteredAlerts, { startDate, endDate, lang: lang as 'he' | 'en' })
      : [],
    [filteredAlerts, startDate, endDate, lang]
  )

  const timeOfDayData = useMemo(
    () => startDate && endDate ? aggregateByTimeOfDay(filteredAlerts) : [],
    [filteredAlerts, startDate, endDate]
  )

  const chartRangeLabel = useMemo(() => {
    if (isCustom) {
      return startDate && endDate
        ? `${formatDate(startDate)} – ${formatDate(endDate)}`
        : ''
    }
    const map: Record<string, string> = {
      '24h': t('24h'),
      '7d': t('last7days'),
      '30d': t('last30days'),
    }
    return map[dateRange] ?? ''
  }, [isCustom, startDate, endDate, dateRange, t])

  const chartSubtitle = useMemo(() => {
    const cityPart = cityLabel || t('allCities')
    return chartRangeLabel ? `${chartRangeLabel} · ${cityPart}` : ''
  }, [chartRangeLabel, cityLabel, t])

  const isLoading = alertsLoading || citiesLoading || categoriesLoading

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    retry()
    if (useTzevaadom) tzevaadomRefetch()
    rankRefetch()
  }, [retry, tzevaadomRefetch, rankRefetch, useTzevaadom])

  useEffect(() => {
    if (isRefreshing && !alertsLoading && !rankLoading) {
      setIsRefreshing(false)
    }
  }, [isRefreshing, alertsLoading, rankLoading])

  const cardStyle = {
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
  } as React.CSSProperties

  const sectionHeadingStyle = {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
    marginBottom: '0.875rem',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* ── CHARTS TAB ── */}
      {activeTab === 'charts' && (
        <>
          {/* Sticky header + accent bar */}
          <div className="sticky top-0 z-40">
            <div style={{ height: 3, background: 'var(--color-accent)' }} />
            <header style={{ background: 'var(--color-header)' }}>
              <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
                    <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
                  </svg>
                  <h1 style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                    {t('appTitle')}
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    aria-label="Refresh data"
                    style={{
                      width: 'calc(1.8rem + 2px)',
                      height: 'calc(1.8rem + 2px)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 7,
                      border: '1px solid rgba(255,255,255,0.22)',
                      color: 'rgba(255,255,255,0.82)',
                      background: 'transparent',
                      cursor: isRefreshing ? 'default' : 'pointer',
                      opacity: isRefreshing ? 0.6 : 1,
                    }}
                  >
                    <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                  </button>
                  <LanguageToggle />
                </div>
              </div>
            </header>
          </div>

          <main
            className="max-w-4xl mx-auto px-4 py-5 space-y-4"
            style={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
          >
            {/* Filters */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem' }}>
              <FilterBar
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                cityLabel={cityLabel}
                onCityLabelChange={setCityLabel}
                categoryId={categoryId}
                onCategoryIdChange={setCategoryId}
                cityLabels={cityLabels}
                categories={filterableCategories}
                customFrom={customFrom}
                onCustomFromChange={setCustomFrom}
                customTo={customTo}
                onCustomToChange={setCustomTo}
              />
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-3 px-1">
              <div
                className="flex items-baseline gap-1.5"
                style={{
                  background: 'var(--color-accent)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '0.3rem 0.875rem',
                }}
              >
                <span data-testid="alert-count" style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1 }}>
                  {filteredAlerts.length.toLocaleString()}{filteredAlerts.length === 3000 ? '+' : ''}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {t('total')}
                </span>
              </div>
              {startDate && endDate && (
                <span
                  dir="ltr"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  {startDate.slice(0, 10) === endDate.slice(0, 10)
                    ? formatDate(startDate)
                    : `${formatDate(startDate)} – ${formatDate(endDate)}`}
                </span>
              )}
            </div>

            {/* Alerts by Day */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', height: 360 }}>
              <p style={{ ...sectionHeadingStyle, marginBottom: chartSubtitle ? '0.1rem' : sectionHeadingStyle.marginBottom }}>{t('chartByDayTitle')}</p>
              {chartSubtitle && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', opacity: 0.75 }}>{chartSubtitle}</p>
              )}
              <div dir="ltr" className="flex items-center justify-center">
                {isLoading && (
                  <div dir="auto" style={{ color: 'var(--color-text-muted)', padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                    <Loader2 size={22} className="animate-spin" style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, opacity: 0.5 }}>{t('loading')}</span>
                  </div>
                )}
                {alertsError && !isLoading && (
                  <div className="text-center space-y-3" style={{ padding: '3rem 0' }}>
                    <p style={{ color: 'var(--color-accent)', fontSize: '0.875rem' }}>{t('errorLoad')}</p>
                    {!isCustom && (
                      <button
                        onClick={retry}
                        style={{
                          padding: '0.4rem 1.25rem',
                          borderRadius: 7,
                          background: 'var(--color-accent)',
                          color: '#fff',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {t('retry')}
                      </button>
                    )}
                  </div>
                )}
                {!isLoading && !alertsError && <ByDayChart data={chartData} categories={categories} />}
              </div>
            </div>

            {/* Alerts by Time of Day */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', height: 775 }}>
              <p style={{ ...sectionHeadingStyle, marginBottom: chartSubtitle ? '0.1rem' : sectionHeadingStyle.marginBottom }}>{t('chartByTimeTitle')}</p>
              {chartSubtitle && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', opacity: 0.75 }}>{chartSubtitle}</p>
              )}
              <div dir="ltr" className="flex items-center justify-center">
                {isLoading && (
                  <div dir="auto" style={{ color: 'var(--color-text-muted)', padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                    <Loader2 size={22} className="animate-spin" style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, opacity: 0.5 }}>{t('loading')}</span>
                  </div>
                )}
                {!isLoading && !alertsError && <TimeOfDayChart data={timeOfDayData} categories={categories} showNowLabels={dateRange === '24h'} />}
              </div>
            </div>

            {/* City Rankings */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem' }}>
              <CityRankingChart
                cities={rankedCities}
                loading={rankLoading}
                error={rankError}
                subtitle={chartRangeLabel}
                cityLabels={cityLabels}
              />
            </div>
          </main>

          {/* Footer */}
          <footer style={{ borderTop: '1px solid var(--color-border)', marginTop: '1.5rem' }}>
            <div
              className="max-w-4xl mx-auto px-5 py-4 text-center"
              style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}
            >
              {t('footerSource')}
              <br />
              {t('footerDeveloper')}{' '}
              <a
                href="https://www.linkedin.com/in/ron-michaeli-a60798115"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {t('developerName')}
              </a>
            </div>
          </footer>
        </>
      )}

      {/* ── MAP TAB (placeholder until Task 11) ── */}
      {activeTab === 'map' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            bottom: TAB_BAR_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
          }}
        >
          Map coming soon
        </div>
      )}

      {/* ── BOTTOM TAB BAR ── */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_BAR_HEIGHT,
          background: 'var(--color-header)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          zIndex: 50,
        }}
      >
        {(['charts', 'map'] as const).map((tab) => {
          const label = tab === 'charts' ? t('tabCharts') : t('tabMap')
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.5)',
                fontSize: '0.7rem',
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '0.04em',
                transition: 'color 0.15s',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon */}
              {tab === 'charts' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
              )}
              {label}
            </button>
          )
        })}
      </nav>

      {/* DonateFAB is always visible on both tabs */}
      <DonateFAB />
    </div>
  )
}
```

**Key change notes:**
- The `DonateFAB` is moved outside both tab conditionals so it renders on both tabs.
- The `<main>` has `paddingBottom: TAB_BAR_HEIGHT + 20` so the City Rankings card is never hidden behind the tab bar on mobile.
- The tab bar uses `zIndex: 50` (same as DonateFAB). DonateFAB currently sits at `bottom: 1.25rem` on screen — this needs updating in Task 6 as well. The DonateFAB's popover opens at `bottom: 5rem`. Once the tab bar is 56px tall, the FAB should sit at `bottom: TAB_BAR_HEIGHT + 20` = `76px` and the popover at `bottom: TAB_BAR_HEIGHT + 64` = `120px`. However, DonateFAB controls its own positioning internally. The simplest fix is to pass a `bottomOffset` prop to `DonateFAB`, or simply update the hardcoded values in `DonateFAB.tsx`.

**DonateFAB update** — modify `components/DonateFAB.tsx`: change the FAB's `bottom: '1.25rem'` to `bottom: '4.75rem'` (1.25rem + 56px tab bar ≈ 4.75rem) and the popover's `bottom: '5rem'` to `bottom: '8.5rem'`.

```tsx
// In DonateFAB.tsx — FAB button style:
bottom: '4.75rem',   // was '1.25rem' — lifted above tab bar

// In DonateFAB.tsx — Popover div style:
bottom: '8.5rem',    // was '5rem' — lifted above FAB + tab bar
```

### Verification

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npm run dev
```

Open http://localhost:3000. Verify:
- Tab bar visible at bottom with "גרפים" and "מפה" labels (Hebrew default)
- Clicking "גרפים" shows existing charts content
- Clicking "מפה" shows "Map coming soon" text
- DonateFAB is visible and above the tab bar on both tabs
- Existing tests still pass: `npm test`

### Commit

```
git add app/page.tsx components/DonateFAB.tsx
git commit -m "feat: add bottom tab bar with Charts and Map tabs"
```

---

## Task 7 — Add hooks/useRealtimeAlerts.ts + tests

**Files to create:**
- `hooks/useRealtimeAlerts.ts`
- `hooks/__tests__/useRealtimeAlerts.test.ts`

### 7a — Create the hook

Create `hooks/useRealtimeAlerts.ts`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAlertHistory } from '@/lib/oref'
import type { AlarmHistoryItem } from '@/types/oref'

const TEN_MINUTES_MS = 10 * 60 * 1000

interface UseRealtimeAlertsOptions {
  lang?: 'he' | 'en'
}

interface RealtimeAlert {
  city: string
  categories: Set<number>
}

export interface UseRealtimeAlertsResult {
  /** Alerts from the last 10 minutes, grouped by city */
  cityAlerts: Map<string, RealtimeAlert>
  /** Raw alerts returned by the API (full mode=1 window, unfiltered) */
  rawAlerts: AlarmHistoryItem[]
  /** Timestamp of the last successful fetch, or null before first fetch */
  lastUpdated: Date | null
  loading: boolean
  error: string | null
}

/**
 * Polls Oref mode=1 (last 24h) every 30 seconds.
 * Filters client-side to the last 10 minutes and groups by city.
 *
 * alertDate format: "YYYY-MM-DDTHH:MM:SS" — Israel local time (Asia/Jerusalem).
 * new Date(alertDate) is treated as LOCAL time by the JS engine, which works
 * correctly when the user's device is in Israel or the server is running TZ=Asia/Jerusalem.
 * For correctness across all timezones, we compare using the raw string if needed,
 * but since oref's timestamps are already local-Israel, new Date() is sufficient
 * for the 10-minute window check.
 */
export function useRealtimeAlerts({ lang = 'he' }: UseRealtimeAlertsOptions = {}): UseRealtimeAlertsResult {
  const { data, dataUpdatedAt, isLoading, error } = useQuery<AlarmHistoryItem[]>({
    queryKey: ['realtime-alerts', lang],
    queryFn: () => fetchAlertHistory({ mode: 1, lang }),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const rawAlerts = data ?? []

  const cityAlerts = new Map<string, RealtimeAlert>()

  if (rawAlerts.length > 0) {
    const cutoff = Date.now() - TEN_MINUTES_MS
    for (const alert of rawAlerts) {
      const alertTs = new Date(alert.alertDate).getTime()
      if (alertTs < cutoff) continue
      const existing = cityAlerts.get(alert.data)
      if (existing) {
        existing.categories.add(alert.category)
      } else {
        cityAlerts.set(alert.data, { city: alert.data, categories: new Set([alert.category]) })
      }
    }
  }

  return {
    cityAlerts,
    rawAlerts,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
```

### 7b — Create tests

The project has no `hooks/__tests__` directory yet. Create `hooks/__tests__/useRealtimeAlerts.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRealtimeAlerts } from '../useRealtimeAlerts'

// Mock lib/oref
jest.mock('@/lib/oref', () => ({
  fetchAlertHistory: jest.fn(),
}))

import { fetchAlertHistory } from '@/lib/oref'
const mockFetch = fetchAlertHistory as jest.MockedFunction<typeof fetchAlertHistory>

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

// Fixed "now" for deterministic 10-min window tests
const NOW = new Date('2026-03-14T12:00:00.000Z').getTime()

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  mockFetch.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useRealtimeAlerts', () => {
  it('returns loading=true initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    expect(result.current.loading).toBe(true)
    expect(result.current.cityAlerts.size).toBe(0)
    expect(result.current.lastUpdated).toBeNull()
  })

  it('returns empty cityAlerts when API returns []', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.cityAlerts.size).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('filters out alerts older than 10 minutes', async () => {
    // 5 min ago = within window; 15 min ago = outside window
    const fiveMinsAgo = new Date(NOW - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', 'T')
    const fifteenMinsAgo = new Date(NOW - 15 * 60 * 1000).toISOString().slice(0, 19).replace('T', 'T')

    mockFetch.mockResolvedValue([
      {
        data: 'תל אביב',
        date: '14/03/2026',
        time: '11:55:00',
        alertDate: fiveMinsAgo,
        category: 1,
        category_desc: 'ירי רקטות וטילים',
        matrix_id: 1,
        rid: 1,
      },
      {
        data: 'ירושלים',
        date: '14/03/2026',
        time: '11:45:00',
        alertDate: fifteenMinsAgo,
        category: 1,
        category_desc: 'ירי רקטות וטילים',
        matrix_id: 1,
        rid: 2,
      },
    ])

    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.cityAlerts.size).toBe(1)
    expect(result.current.cityAlerts.has('תל אביב')).toBe(true)
    expect(result.current.cityAlerts.has('ירושלים')).toBe(false)
  })

  it('groups multiple categories for the same city', async () => {
    const recentTs = new Date(NOW - 2 * 60 * 1000).toISOString().slice(0, 19)

    mockFetch.mockResolvedValue([
      {
        data: 'תל אביב',
        date: '14/03/2026',
        time: '11:58:00',
        alertDate: recentTs,
        category: 1, // missile
        category_desc: 'ירי רקטות וטילים',
        matrix_id: 1,
        rid: 10,
      },
      {
        data: 'תל אביב',
        date: '14/03/2026',
        time: '11:59:00',
        alertDate: recentTs,
        category: 2, // uav
        category_desc: 'חדירת כלי טיס עוין',
        matrix_id: 6,
        rid: 11,
      },
    ])

    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const ta = result.current.cityAlerts.get('תל אביב')
    expect(ta).toBeDefined()
    expect(ta!.categories.has(1)).toBe(true)
    expect(ta!.categories.has(2)).toBe(true)
  })

  it('returns error string when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network error')
  })

  it('sets lastUpdated after successful fetch', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  it('passes lang to fetchAlertHistory', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useRealtimeAlerts({ lang: 'en' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFetch).toHaveBeenCalledWith({ mode: 1, lang: 'en' })
  })
})
```

### Run tests

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npm test -- hooks/__tests__/useRealtimeAlerts.test.ts
```

Expected: 6 tests passing, 0 failing.

If the `hooks/__tests__` directory is new, Jest will find it automatically because `jest.config.ts` has no explicit `testMatch` (it uses Next.js defaults which pick up `**/__tests__/**/*.{ts,tsx}`).

### Commit

```
git add hooks/useRealtimeAlerts.ts hooks/__tests__/useRealtimeAlerts.test.ts
git commit -m "feat: add useRealtimeAlerts hook with 30s polling and tests"
```

---

## Task 8 — Add components/RealtimeMap.tsx

**Files to create:**
- `components/RealtimeMap.tsx`

**Important:** This component is only ever rendered via `next/dynamic({ ssr: false })` from `MapView`. It is NOT tested (Leaflet doesn't work in jsdom).

### Steps

Create `components/RealtimeMap.tsx`:

```tsx
'use client'

// Leaflet CSS must be imported inside the dynamically-loaded component, not at the app root.
// Because this file is only ever loaded via next/dynamic({ ssr: false }), the import
// executes only on the client, avoiding SSR crashes.
import 'leaflet/dist/leaflet.css'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts'
import { getCityCoords } from '@/lib/citiesGeo'
import { useI18n } from '@/lib/i18n'

// Oref category IDs — must stay in sync with oref API
// These values are confirmed via the categories fixture and lib/chartColors.ts
const CATEGORY_MISSILE = 1   // missilealert
const CATEGORY_UAV = 2       // uav
const CATEGORY_FLASH = 3     // flash (category id 3 based on oref categories API — confirm at runtime)

// Colors from lib/chartColors.ts
const COLOR_MISSILE = '#E01515'
const COLOR_UAV = '#7A1010'
const COLOR_FLASH = '#E07800'

// Circle sizes
const RADIUS_SINGLE = 8
const RADIUS_OUTER = 12   // UAV outer ring when co-occurring with missile
const RADIUS_INNER = 7    // Missile inner fill when co-occurring with UAV

interface CityMarkerProps {
  cityName: string
  categories: Set<number>
  lat: number
  lng: number
}

function CityMarker({ cityName: _cityName, categories, lat, lng }: CityMarkerProps) {
  const hasMissile = categories.has(CATEGORY_MISSILE)
  const hasUAV = categories.has(CATEGORY_UAV)
  const hasFlash = categories.has(CATEGORY_FLASH)

  // Flash never co-occurs with other types per design doc
  if (hasFlash && !hasMissile && !hasUAV) {
    return (
      <CircleMarker
        center={[lat, lng]}
        radius={RADIUS_SINGLE}
        pathOptions={{ fillColor: COLOR_FLASH, color: COLOR_FLASH, fillOpacity: 0.85, weight: 1.5 }}
      />
    )
  }

  if (hasMissile && hasUAV) {
    // Concentric rings: outer UAV (larger, transparent fill), inner Missile (filled)
    return (
      <>
        <CircleMarker
          center={[lat, lng]}
          radius={RADIUS_OUTER}
          pathOptions={{ fillColor: COLOR_UAV, color: COLOR_UAV, fillOpacity: 0.35, weight: 2.5 }}
        />
        <CircleMarker
          center={[lat, lng]}
          radius={RADIUS_INNER}
          pathOptions={{ fillColor: COLOR_MISSILE, color: COLOR_MISSILE, fillOpacity: 0.9, weight: 0 }}
        />
      </>
    )
  }

  if (hasUAV) {
    return (
      <CircleMarker
        center={[lat, lng]}
        radius={RADIUS_SINGLE}
        pathOptions={{ fillColor: COLOR_UAV, color: COLOR_UAV, fillOpacity: 0.85, weight: 1.5 }}
      />
    )
  }

  if (hasMissile) {
    return (
      <CircleMarker
        center={[lat, lng]}
        radius={RADIUS_SINGLE}
        pathOptions={{ fillColor: COLOR_MISSILE, color: COLOR_MISSILE, fillOpacity: 0.85, weight: 1.5 }}
      />
    )
  }

  // Fallback for any other category — single accent-colored circle
  return (
    <CircleMarker
      center={[lat, lng]}
      radius={RADIUS_SINGLE}
      pathOptions={{ fillColor: '#CC1212', color: '#CC1212', fillOpacity: 0.85, weight: 1.5 }}
    />
  )
}

/** Forces the map to invalidate its size after mounting — prevents grey tile areas. */
function MapResizer() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

export function RealtimeMap() {
  const { lang } = useI18n()
  const { cityAlerts, lastUpdated, loading, error } = useRealtimeAlerts({ lang })

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--'

  const { t } = useI18n()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[31.5, 34.8]}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />

        {Array.from(cityAlerts.entries()).map(([cityName, data]) => {
          const coords = getCityCoords(cityName)
          if (!coords) return null
          return (
            <CityMarker
              key={cityName}
              cityName={cityName}
              categories={data.categories}
              lat={coords.lat}
              lng={coords.lng}
            />
          )
        })}
      </MapContainer>

      {/* Last updated badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(17,17,17,0.82)',
          color: '#fff',
          borderRadius: 8,
          padding: '4px 12px',
          fontSize: '0.75rem',
          fontWeight: 500,
          zIndex: 1000,
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backdropFilter: 'blur(4px)',
        }}
      >
        {loading && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
        )}
        {t('mapLastUpdated')}: <span dir="ltr">{lastUpdatedStr}</span>
      </div>

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.78rem',
            fontWeight: 600,
            zIndex: 1000,
          }}
        >
          {t('errorLoad')}
        </div>
      )}
    </div>
  )
}
```

**Category ID note:** The fixture confirms category `1` = missile, `2` = UAV. The `flash` category ID is `3` based on the Oref categories API (slug `flash`, `matrix_id` not shown in the test fixture). If flash has a different ID in production, the `CATEGORY_FLASH` constant must be corrected. Alternatively, look up by slug from the categories list — but for the map, using the hardcoded ID is simpler. Verify by calling `/api/categories` in the dev environment and checking the flash entry.

### Commit

```
git add components/RealtimeMap.tsx
git commit -m "feat: add RealtimeMap component with CircleMarker alert visualization"
```

---

## Task 9 — Add components/HistoryMap.tsx

**Files to create:**
- `components/HistoryMap.tsx`

Create `components/HistoryMap.tsx`:

```tsx
'use client'

import 'leaflet/dist/leaflet.css'

import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { fetchTzevaadomRaw, TZEVAADOM_ALLOWED_CODES, normalizeTzevaadomCity } from '@/lib/tzevaadom'
import { getCityCoords } from '@/lib/citiesGeo'
import { getPresetDateRange } from '@/lib/dateRange'
import { useI18n } from '@/lib/i18n'
import type { DateRangeOption } from '@/types/oref'

// ── Color interpolation ──────────────────────────────────────────────────────

/** Linear interpolation between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Returns a hex color interpolated across green → yellow → red.
 * ratio 0.0 → #22c55e (green)
 * ratio 0.5 → #eab308 (yellow)
 * ratio 1.0 → #E01515 (red)
 */
export function interpolateColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio))

  let red: number, green: number, blue: number

  if (r < 0.5) {
    // green → yellow
    const t = r * 2
    red   = Math.round(lerp(0x22, 0xea, t))
    green = Math.round(lerp(0xc5, 0xb3, t))
    blue  = Math.round(lerp(0x5e, 0x08, t))
  } else {
    // yellow → red
    const t = (r - 0.5) * 2
    red   = Math.round(lerp(0xea, 0xe0, t))
    green = Math.round(lerp(0xb3, 0x15, t))
    blue  = Math.round(lerp(0x08, 0x15, t))
  }

  return `rgb(${red},${green},${blue})`
}

// ── Radius scale ─────────────────────────────────────────────────────────────

const RADIUS_MIN = 4
const RADIUS_MAX = 18

function scaleRadius(count: number, maxCount: number): number {
  if (maxCount === 0) return RADIUS_MIN
  const ratio = count / maxCount
  return RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * ratio
}

// ── MapResizer (same as RealtimeMap) ─────────────────────────────────────────

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

// ── Main component ────────────────────────────────────────────────────────────

interface CityCount {
  cityName: string
  count: number
  lat: number
  lng: number
}

export function HistoryMap() {
  const { t } = useI18n()
  const [dateRange, setDateRange] = useState<Exclude<DateRangeOption, 'custom'>>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const isCustom = (dateRange as string) === 'custom'

  const { startDate, endDate } = useMemo(() => {
    if (isCustom) return { startDate: customFrom, endDate: customTo }
    return getPresetDateRange(dateRange)
  }, [isCustom, customFrom, customTo, dateRange])

  const startTs = useMemo(
    () => startDate ? new Date(startDate.includes('T') ? startDate : startDate + 'T00:00').getTime() / 1000 : 0,
    [startDate],
  )
  const endTs = useMemo(
    () => endDate ? new Date(endDate.includes('T') ? endDate : endDate + 'T23:59:59').getTime() / 1000 : Date.now() / 1000,
    [endDate],
  )

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['tzevaadomRaw'],
    queryFn: fetchTzevaadomRaw,
    staleTime: 30 * 60 * 1000,
  })

  const cityCounts = useMemo<CityCount[]>(() => {
    if (!raw) return []
    const counts = new Map<string, number>()
    for (const [, code, cityArr, ts] of raw) {
      if (!TZEVAADOM_ALLOWED_CODES.has(code)) continue
      if (ts < startTs || ts > endTs) continue
      for (const rawCity of cityArr) {
        const city = normalizeTzevaadomCity(rawCity)
        counts.set(city, (counts.get(city) ?? 0) + 1)
      }
    }
    const result: CityCount[] = []
    for (const [cityName, count] of counts.entries()) {
      const coords = getCityCoords(cityName)
      if (!coords) continue
      result.push({ cityName, count, lat: coords.lat, lng: coords.lng })
    }
    return result
  }, [raw, startTs, endTs])

  const maxCount = useMemo(
    () => cityCounts.reduce((m, c) => Math.max(m, c.count), 0),
    [cityCounts],
  )

  const selectClass =
    'rounded-lg border bg-white ps-3 pe-3 py-1.5 text-sm focus:outline-none focus:ring-1 appearance-none' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]'

  const dateInputClass =
    'rounded-lg border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Date range selector — floated above map */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 10,
          padding: '8px 14px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(6px)',
        }}
      >
        <select
          value={isCustom ? 'custom' : dateRange}
          onChange={(e) => setDateRange(e.target.value as Exclude<DateRangeOption, 'custom'>)}
          className={selectClass}
        >
          <option value="24h">{t('24h')}</option>
          <option value="7d">{t('last7days')}</option>
          <option value="30d">{t('last30days')}</option>
          <option value="custom">{t('custom')}</option>
        </select>

        {isCustom && (
          <>
            <input
              type="date"
              dir="ltr"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={dateInputClass}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>–</span>
            <input
              type="date"
              dir="ltr"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={dateInputClass}
            />
          </>
        )}
      </div>

      <MapContainer
        center={[31.5, 34.8]}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />

        {cityCounts.map(({ cityName, count, lat, lng }) => {
          const ratio = maxCount > 0 ? count / maxCount : 0
          const color = interpolateColor(ratio)
          const radius = scaleRadius(count, maxCount)
          return (
            <CircleMarker
              key={cityName}
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                color: color,
                fillOpacity: 0.75,
                weight: 1,
              }}
            />
          )
        })}
      </MapContainer>

      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(242,241,238,0.7)',
            zIndex: 999,
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          {t('loading')}
        </div>
      )}

      {/* Error overlay */}
      {error && !isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.78rem',
            fontWeight: 600,
            zIndex: 1000,
          }}
        >
          {t('errorLoad')}
        </div>
      )}
    </div>
  )
}
```

### Commit

```
git add components/HistoryMap.tsx
git commit -m "feat: add HistoryMap component with heatmap rendering"
```

---

## Task 10 — Add components/MapView.tsx

**Files to create:**
- `components/MapView.tsx`

This is the root of the Map tab. It:
1. Renders the mode toggle bar at the top.
2. Dynamically imports `RealtimeMap` and `HistoryMap` with `{ ssr: false }`.
3. Renders the appropriate map based on the selected mode.

Create `components/MapView.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

// Dynamic imports — Leaflet crashes in SSR. ssr: false guarantees client-only rendering.
const RealtimeMap = dynamic(
  () => import('@/components/RealtimeMap').then((m) => m.RealtimeMap),
  {
    ssr: false,
    loading: () => (
      <MapLoadingPlaceholder />
    ),
  }
)

const HistoryMap = dynamic(
  () => import('@/components/HistoryMap').then((m) => m.HistoryMap),
  {
    ssr: false,
    loading: () => (
      <MapLoadingPlaceholder />
    ),
  }
)

function MapLoadingPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e8e4de',
        color: '#A09890',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      ...
    </div>
  )
}

type MapMode = 'realtime' | 'history'

const TOP_BAR_HEIGHT = 48

export function MapView() {
  const { t } = useI18n()
  const [mode, setMode] = useState<MapMode>('realtime')

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Mode toggle bar */}
      <div
        style={{
          height: TOP_BAR_HEIGHT,
          background: 'var(--color-header)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          gap: 4,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {(['realtime', 'history'] as MapMode[]).map((m) => {
          const isActive = mode === m
          const label = m === 'realtime' ? t('mapModeRealtime') : t('mapModeHistory')
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '5px 18px',
                borderRadius: 20,
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.2)',
                background: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Map area — fills remaining space above tab bar */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {mode === 'realtime' ? <RealtimeMap /> : <HistoryMap />}
      </div>
    </div>
  )
}
```

**Layout explanation:**
- `MapView` is `position: fixed; inset: 0` — it fills the entire viewport.
- The bottom edge of `inset: 0` lands at `bottom: 0`. The tab bar sits on top with `zIndex: 50`. The map's content area (below the top bar) will be partially obscured by the tab bar at the very bottom, but Leaflet's attribution and zoom controls are auto-positioned and the critical map content is visible.
- Alternatively, set `bottom: 56px` (the tab bar height) so the map never goes under it. This is cleaner and recommended: change `inset: 0` to explicit `top: 0; left: 0; right: 0; bottom: 56px` in the outer div.

**Corrected `MapView` outer div style** (preferred):

```tsx
<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, display: 'flex', flexDirection: 'column' }}>
```

Where `56` is `TAB_BAR_HEIGHT` from page.tsx. To avoid hardcoding, pass it as a prop or define a shared constant in a new `lib/layout.ts`:

```typescript
// lib/layout.ts
export const TAB_BAR_HEIGHT = 56
```

Then import in both `app/page.tsx` and `components/MapView.tsx`.

### Commit

```
git add components/MapView.tsx lib/layout.ts
git commit -m "feat: add MapView component with mode toggle and dynamic Leaflet imports"
```

---

## Task 11 — Wire MapView into the Map tab in page.tsx

**Files to modify:**
- `app/page.tsx`

### Steps

Replace the Map tab placeholder from Task 6 with the real `<MapView />`.

1. Add the import at the top of `app/page.tsx`:

```tsx
import { MapView } from '@/components/MapView'
```

2. Replace the Map tab placeholder block:

```tsx
// REMOVE this:
{activeTab === 'map' && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      bottom: TAB_BAR_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      color: 'var(--color-text-muted)',
      fontSize: '0.9rem',
    }}
  >
    Map coming soon
  </div>
)}

// REPLACE with:
{activeTab === 'map' && <MapView />}
```

That's the entire change. `MapView` itself handles all layout (fixed positioning, top bar, map area).

### Full verification

```bash
cd /Users/ronmichaeli/dev/oref-alerts
npm run dev
```

Open http://localhost:3000. Test the following:

**Tab bar:**
- [ ] Tab bar visible at bottom of screen in both Hebrew (גרפים / מפה) and English (Charts / Map)
- [ ] Active tab is highlighted in red; inactive tab is dimmed
- [ ] Switching tabs is instant; Charts tab state is preserved when returning

**Charts tab:**
- [ ] All existing charts load and function correctly
- [ ] No content hidden behind the tab bar (verify by scrolling to bottom of City Rankings)
- [ ] DonateFAB visible above tab bar

**Map tab — Real-time mode:**
- [ ] Map loads centered on Israel at zoom 8 (no grey tiles)
- [ ] Mode toggle shows "זמן אמת" active by default
- [ ] "עדכון אחרון: HH:MM:SS" badge appears at map bottom
- [ ] If there are active alerts, CircleMarkers appear at correct city positions
- [ ] Badge updates every 30 seconds

**Map tab — History mode:**
- [ ] Clicking "היסטוריה" switches to heatmap
- [ ] Date range selector appears as floating overlay at top
- [ ] Circles appear for cities with alerts, colored green→red
- [ ] Changing the date range re-renders the heatmap
- [ ] Custom date range inputs appear when "אחר" is selected

**Language toggle:**
- [ ] Switching to English changes tab labels to Charts/Map, mode labels to Real-time/History, "Last updated"

**Run full test suite:**

```bash
npm test
```

Expected: all existing tests pass + 6 new tests in `useRealtimeAlerts.test.ts`.

### TypeScript check:

```bash
npx tsc --noEmit
```

Expected: no errors.

### Commit

```
git add app/page.tsx
git commit -m "feat: wire MapView into Map tab — Alerts Map epic complete"
```

---

## Summary of all files created/modified

| Task | File | Action |
|------|------|--------|
| 1 | `package.json` | Modified — new deps |
| 2 | `lib/translations/he.json` | Modified — 5 new keys |
| 2 | `lib/translations/en.json` | Modified — 5 new keys |
| 3 | `scripts/generate-cities-geo.ts` | Created |
| 3 | `public/cities-geo.json` | Created (script output) |
| 4 | `lib/citiesGeo.ts` | Created |
| 5 | `scripts/validate-cities-geo.ts` | Created |
| 6 | `app/page.tsx` | Modified — tab bar + conditional rendering |
| 6 | `components/DonateFAB.tsx` | Modified — lift bottom position above tab bar |
| 7 | `hooks/useRealtimeAlerts.ts` | Created |
| 7 | `hooks/__tests__/useRealtimeAlerts.test.ts` | Created |
| 8 | `components/RealtimeMap.tsx` | Created |
| 9 | `components/HistoryMap.tsx` | Created |
| 10 | `components/MapView.tsx` | Created |
| 10 | `lib/layout.ts` | Created — shared `TAB_BAR_HEIGHT` constant |
| 11 | `app/page.tsx` | Modified — replace placeholder with `<MapView />` |

---

## Potential pitfalls and mitigations

**Leaflet default icon broken in Next.js**
Leaflet's default marker icon (`L.Icon.Default`) loads images via a relative URL that breaks in webpack. Since the plan uses only `CircleMarker` (SVG-rendered, no external images), this is not an issue. If `Marker` is ever added, use `L.Icon.Default.mergeOptions({ iconUrl: '...', ... })` in a `useEffect`.

**`new Date(alertDate)` timezone sensitivity**
`alertDate` format `"YYYY-MM-DDTHH:MM:SS"` (no timezone suffix) is parsed as local time by JS. In production (Vercel, Edge), the server's timezone may differ from Israel (UTC+2/3). Since `useRealtimeAlerts` runs entirely on the client (`'use client'`), the device timezone is used. For Israeli users, this is correct. The 10-minute window comparison is a relative duration check (`Date.now() - 10 * 60 * 1000`), so small timezone offsets don't cause correctness failures — only a city on the boundary of the 10-minute window might be included or excluded by a few seconds. This is acceptable.

**Nominatim rate limiting**
The geocoding script includes a 1,100ms sleep between requests. Do not run it concurrently. If the script is interrupted, re-run from the last failed city by modifying the script to skip already-geocoded entries (compare against a partial output file).

**cities-geo.json bundle size**
At ~1,300 entries × ~50 bytes = ~65KB. `lib/citiesGeo.ts` imports the JSON statically, which means Next.js bundles it into the client JS. This is acceptable for this project. If it becomes a concern, convert to a dynamic `fetch('/cities-geo.json')` at runtime.

**Flash category ID**
The existing `categories.ts` fixture only covers IDs 1 (missile) and 2 (UAV). Flash has a different ID in production — verify by calling `/api/categories` in the dev environment and inspecting the response. Update `CATEGORY_FLASH` in `RealtimeMap.tsx` accordingly. The design doc states "Flash never co-occurs with other types", so the visual distinction is straightforward once the ID is confirmed.

**DonateFAB z-index vs tab bar z-index**
Both are `zIndex: 50`. The FAB appears after the tab bar in DOM order in `page.tsx`, so it paints on top. Verify visually that the FAB heart icon is not obscured.

---

### Critical Files for Implementation

- `/Users/ronmichaeli/dev/oref-alerts/app/page.tsx` - Primary file to modify: add tab bar, conditional rendering, wire MapView
- `/Users/ronmichaeli/dev/oref-alerts/hooks/useTzevaadomAlerts.ts` - Pattern to follow for `useRealtimeAlerts` (React Query + `useQuery` structure)
- `/Users/ronmichaeli/dev/oref-alerts/lib/oref.ts` - `fetchAlertHistory` function called by the new hook; `mode: 1` is the realtime endpoint
- `/Users/ronmichaeli/dev/oref-alerts/lib/tzevaadom.ts` - `fetchTzevaadomRaw`, `TZEVAADOM_ALLOWED_CODES`, `normalizeTzevaadomCity` — all reused directly in `HistoryMap`
- `/Users/ronmichaeli/dev/oref-alerts/types/oref.ts` - `AlarmHistoryItem` type used throughout; `alertDate` field format is the key to the 10-minute filter logic

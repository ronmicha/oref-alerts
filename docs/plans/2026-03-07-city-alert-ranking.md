# City Alert Ranking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "City Alert Ranking" chart below the existing charts, showing all cities sorted by alert count over the last 7 days, with progressive/parallel loading and a sort toggle.

**Architecture:** A new `useAllCitiesAlerts` hook fetches one API request per city (mode=2 = 7 days) using a 20-worker concurrency pool. Results stream into state as each batch of city requests completes (debounced 150ms flush). A new `CityRankingChart` component renders the data as a scrollable horizontal bar chart.

**Tech Stack:** React hooks, `fetchAlertHistory` from `lib/oref.ts`, Recharts `BarChart` (layout="vertical"), Tailwind CSS, `useI18n` for translations.

**Important constraints:**
- This chart is NOT affected by the filter bar — it always shows the last 7 days for all cities
- Only cities with `count > 0` are shown in the chart
- Do NOT push to remote until the user explicitly says so

---

### Task 1: Add translations

**Files:**
- Modify: `lib/translations/en.json`
- Modify: `lib/translations/he.json`

**Step 1: Add 4 new keys to `lib/translations/en.json`**

Add after the `"filterToDate"` line (before `"langToggle"`):

```json
  "chartByCityTitle": "City Alert Ranking",
  "cityRankingLoading": "Loading {loaded} of {total} cities…",
  "sortMostFirst": "Most first",
  "sortLeastFirst": "Least first",
```

Full updated section of `en.json` (lines 18–22 area):
```json
  "filterToDate": "To date",
  "chartByCityTitle": "City Alert Ranking",
  "cityRankingLoading": "Loading {loaded} of {total} cities…",
  "sortMostFirst": "Most first",
  "sortLeastFirst": "Least first",
  "langToggle": "עברית",
```

**Step 2: Add same 4 keys to `lib/translations/he.json`**

Add after the `"filterToDate"` line (before `"langToggle"`):
```json
  "filterToDate": "עד תאריך",
  "chartByCityTitle": "דירוג ערים לפי התרעות",
  "cityRankingLoading": "טוען {loaded} מתוך {total} ערים…",
  "sortMostFirst": "הכי הרבה קודם",
  "sortLeastFirst": "הכי מעט קודם",
  "langToggle": "English",
```

**Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit`
Expected: no errors (the `t()` function key type is inferred from `typeof he`, so adding keys to both files makes them valid)

**Step 4: Commit**

```bash
git add lib/translations/en.json lib/translations/he.json
git commit -m "feat: add city ranking translations"
```

---

### Task 2: Create `hooks/useAllCitiesAlerts.ts`

**Files:**
- Create: `hooks/useAllCitiesAlerts.ts`

**Step 1: Create the file with this exact content**

```ts
'use client'

import { useState, useEffect } from 'react'
import { fetchAlertHistory } from '@/lib/oref'

export interface CityCount {
  label: string
  count: number
}

/**
 * Fetches 7-day alert counts for every city in parallel (up to 20 concurrent).
 * Results stream into state as cities complete; only cities with count > 0 are included.
 */
export function useAllCitiesAlerts(cityLabels: string[], lang: 'he' | 'en') {
  const [cities, setCities] = useState<CityCount[]>([])
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!cityLabels.length) return

    setCities([])
    setLoaded(0)
    setDone(false)
    setTotal(cityLabels.length)

    let cancelled = false
    let index = 0
    let loadedCount = 0
    const pending: CityCount[] = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    function flush() {
      if (cancelled) return
      const batch = pending.splice(0)
      if (batch.length > 0) setCities((prev) => [...prev, ...batch])
      setLoaded(loadedCount)
      flushTimer = null
    }

    function scheduleFlush() {
      if (!flushTimer) flushTimer = setTimeout(flush, 150)
    }

    async function worker() {
      while (!cancelled) {
        const i = index++
        if (i >= cityLabels.length) break
        try {
          const alerts = await fetchAlertHistory({ mode: 2, city: cityLabels[i], lang })
          if (!cancelled) {
            loadedCount++
            if (alerts.length > 0) pending.push({ label: cityLabels[i], count: alerts.length })
            scheduleFlush()
          }
        } catch {
          if (!cancelled) {
            loadedCount++
            scheduleFlush()
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(20, cityLabels.length) }, () => worker())

    Promise.all(workers).then(() => {
      if (!cancelled) {
        flush()
        setDone(true)
      }
    })

    return () => {
      cancelled = true
      if (flushTimer) clearTimeout(flushTimer)
    }
  }, [cityLabels, lang])

  return { cities, loaded, total, done }
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add hooks/useAllCitiesAlerts.ts
git commit -m "feat: add useAllCitiesAlerts hook with 20-worker pool"
```

---

### Task 3: Create `components/CityRankingChart.tsx`

**Files:**
- Create: `components/CityRankingChart.tsx`

**Context:** This component renders a horizontal bar chart (Recharts with `layout="vertical"`) showing cities sorted by alert count. It has a sort toggle button, a loading progress banner while fetching, and a scrollable container since there can be hundreds of cities.

**Step 1: Create the file with this exact content**

```tsx
'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { CityCount } from '@/hooks/useAllCitiesAlerts'
import { useI18n } from '@/lib/i18n'

interface CityRankingChartProps {
  cities: CityCount[]
  loaded: number
  total: number
  done: boolean
}

export function CityRankingChart({ cities, loaded, total, done }: CityRankingChartProps) {
  const { t } = useI18n()
  const [sortDesc, setSortDesc] = useState(true)

  const withAlerts = cities.filter((c) => c.count > 0)
  const sorted = [...withAlerts].sort((a, b) => sortDesc ? b.count - a.count : a.count - b.count)

  // 20px per bar row + margins
  const chartHeight = Math.max(200, sorted.length * 20 + 60)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{t('chartByCityTitle')}</h2>
        {withAlerts.length > 0 && (
          <button
            onClick={() => setSortDesc((d) => !d)}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            {sortDesc ? t('sortLeastFirst') : t('sortMostFirst')}
          </button>
        )}
      </div>

      {/* Loading progress banner */}
      {!done && total > 0 && (
        <div className="mb-3 text-xs text-blue-600 bg-blue-50 rounded px-3 py-2 animate-pulse">
          {t('cityRankingLoading', { loaded, total })}
        </div>
      )}

      {/* Empty state once done */}
      {done && sorted.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">{t('loading')}</div>
      )}

      {/* Scrollable chart */}
      {sorted.length > 0 && (
        <div dir="ltr" style={{ maxHeight: 600, overflowY: 'auto' }}>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
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
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  width={180}
                />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as CityCount
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow text-sm">
                        <div className="font-medium text-gray-700">{d.label}</div>
                        <div className="text-gray-600 font-bold text-blue-600">{d.count}</div>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#3B82F6"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add components/CityRankingChart.tsx
git commit -m "feat: add CityRankingChart component"
```

---

### Task 4: Integrate into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Context:**
- `useCities` computes `cityLabels` as a new array reference on every render (it uses `[...new Set(...)]` inline). This would cause `useAllCitiesAlerts`'s effect to re-run on every render, resetting the fetch. Fix by memoizing `cityLabels` with the `cities` array as the dependency.
- The ranking chart must NOT be affected by the filter bar — pass the unfiltered `cityLabels` (all cities), not the selected `cityLabel`.
- The ranking chart always uses 7-day data regardless of the selected `dateRange`.

**Step 1: Add imports at the top of `app/page.tsx`**

After the existing imports, add:
```ts
import { useAllCitiesAlerts } from '@/hooks/useAllCitiesAlerts'
import { CityRankingChart } from '@/components/CityRankingChart'
```

Full import block becomes:
```ts
import { useState, useMemo, useEffect, useRef } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useTzevaadomAlerts } from '@/hooks/useTzevaadomAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { useAllCitiesAlerts } from '@/hooks/useAllCitiesAlerts'
import { FilterBar } from '@/components/FilterBar'
import { AlertChart } from '@/components/AlertChart'
import { TimeOfDayChart } from '@/components/TimeOfDayChart'
import { CityRankingChart } from '@/components/CityRankingChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { filterAlerts, aggregateByDay, aggregateByTimeOfDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import type { DateRangeOption } from '@/types/oref'
```

**Step 2: Stabilize `cityLabels` reference**

Find this line:
```ts
const { cityLabels, loading: citiesLoading } = useCities(lang)
```

Replace it with:
```ts
const { cities: rawCities, cityLabels: unstableCityLabels, loading: citiesLoading } = useCities(lang)
// Stabilize reference — useCities computes cityLabels inline so it's a new array every render.
// Without this, useAllCitiesAlerts would reset on every state update.
const cityLabels = useMemo(() => unstableCityLabels, [rawCities])
```

**Step 3: Add the `useAllCitiesAlerts` hook call**

After the `useCategories` line, add:
```ts
const { cities: rankedCities, loaded: rankLoaded, total: rankTotal, done: rankDone } =
  useAllCitiesAlerts(cityLabels, lang)
```

**Step 4: Add the CityRankingChart section in the JSX**

After the closing `</div>` of the time-of-day chart section, add:
```tsx
{/* City ranking chart */}
<div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
  <CityRankingChart
    cities={rankedCities}
    loaded={rankLoaded}
    total={rankTotal}
    done={rankDone}
  />
</div>
```

**Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 6: Run the dev server and verify manually**

Run: `npm run dev`

Check:
- [ ] "City Alert Ranking" / "דירוג ערים לפי התרעות" title appears below the time-of-day chart
- [ ] Loading progress banner shows "Loading X of Y cities…" and animates
- [ ] Cities with alerts appear progressively in the chart as loading proceeds
- [ ] Sort toggle button switches between most-first and least-first order
- [ ] Changing the date range filter does NOT change the city ranking data
- [ ] Changing the city/category filter does NOT change the city ranking data
- [ ] Toggling language (Hebrew ↔ English) reloads city data correctly
- [ ] Scrolling works when there are many cities

**Step 7: Run build check**

Run: `npm run build`
Expected: no errors

**Step 8: Commit**

```bash
git add app/page.tsx
git commit -m "feat: integrate CityRankingChart into main page"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run build` completes successfully
- [ ] `npm test` passes (existing tests unaffected)
- [ ] City ranking chart loads progressively from 0 to all cities
- [ ] Sort toggle works
- [ ] Filter bar changes have no effect on city ranking
- [ ] Language toggle resets and reloads city data
- [ ] No console errors in the browser

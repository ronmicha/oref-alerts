# Claude Code Instructions

## Git — MANDATORY workflow

**NEVER push directly to `main`.** No exceptions — not for docs, typos, single-liners,
or anything else. `main` is protected and every change must arrive via a pull request.

### Every change must follow this exact flow

1. `git checkout -b <type>/<short-description>` — create a branch off `main`
2. Make commits on that branch
3. `npm test -- --watchAll=false` — **all tests must pass** before pushing
4. `git push -u origin <branch>` — push the branch (NOT main)
5. `gh pr create ...` — open a PR targeting `main`

Never `git push` while on `main`. Never `--force`. Never bypass branch-protection
rule violations — if the remote prints "Bypassed rule violations", that means you
did it wrong.

---

## Project overview

**Lion's Roar (שאגת הארי)** — a Next.js 16 (App Router) dashboard for tracking
IDF Home Front Command (Pikud Ha'Oref) alerts in real time and historically.
Users can filter by city, alert category, and date range; visualise patterns with
charts; and watch a live map of active alerts.

Live: <https://oref-alerts.vercel.app/>

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, `'use client'` components |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + inline CSS-in-JS for dynamic values |
| Charts | Recharts (`BarChart`, `ResponsiveContainer`, …) |
| Data fetching | TanStack React Query v5 (`@tanstack/react-query`) |
| Map | Leaflet via `react-leaflet` (dynamic imports — not SSR-safe) |
| i18n | Custom context in `lib/i18n.tsx` — Hebrew (default, RTL) and English |
| Analytics | Vercel Web Analytics (`@vercel/analytics`) |
| Hosting | Vercel |
| Tests | Jest + `@testing-library/react` (jsdom, `TZ=UTC`) |

---

## Repository structure

```
app/
  layout.tsx          Root layout — ReactQueryProvider, I18nProvider, <Analytics />
  page.tsx            Main page — all state lives here, two tabs: Map (default) and Charts
  api/
    history/          Proxies GET /GetAlarmsHistory from oref.org.il
    cities/           Proxies GET /GetCitiesMix
    categories/       Proxies GET /alertCategories
    tzevaadom/        Fetches + caches tzevaadom.co.il historical JSON

components/           Pure UI components (no data fetching)
  ByDayChart.tsx      Stacked bar chart — alerts per calendar day
  TimeOfDayChart.tsx  Stacked bar chart — alerts by 15-min bucket across 24 h
  CityRankingTable.tsx Sortable city-count table (uses tzevaadom data)
  FilterBar.tsx       Date range selector, city combobox, category select
  MapView.tsx         Tab wrapper for RealtimeMap / HistoryMap; uses dynamic imports
  RealtimeMap.tsx     Live map — polls every 30 s via useRealtimeAlerts
  HistoryMap.tsx      Historical alert-density map
  ChartTouchWrapper.tsx Blocks tooltip during scroll on touch devices
  ReactQueryProvider.tsx Client-only QueryClient provider
  LanguageToggle.tsx  He/En toggle button

hooks/
  useAlerts.ts        Fetches oref history; React Query, polls every 30 s
  useTzevaadomAlerts.ts Fetches full tzevaadom history (custom date ranges)
  useCities.ts        Fetches city list for the combobox
  useCategories.ts    Fetches alert categories
  useCityRankings.ts  Computes per-city counts from tzevaadom raw data
  useRealtimeAlerts.ts Polls mode=1, filters to last 10 min, groups by city

lib/
  filter.ts           filterAlerts(), aggregateByDay(), aggregateByTimeOfDay()
  dateRange.ts        getPresetDateRange() — returns local-time datetime strings
  oref.ts             fetchAlertHistory(), fetchCities(), fetchCategories()
  orefFetch.ts        Low-level fetch with oref browser headers; safe JSON parse
  tzevaadom.ts        fetchTzevaadomRaw(), fetchTzevaadomHistory(), normalisation
  i18n.tsx            useI18n() hook + I18nProvider; translations in lib/translations/
  chartColors.ts      getCategoryColor() — consistent colour per category ID
  layout.ts           TAB_BAR_HEIGHT, HEADER_HEIGHT constants

types/oref.ts         AlarmHistoryItem, City, AlertCategory, DayCount, …
tests/fixtures/       Static test data (alertHistory, cities, categories, tzevaadomRaw)
```

---

## Architecture & data flow

### Two data sources

| Source | Used for | Hook |
|---|---|---|
| **oref.org.il** (via AWS Lambda proxy in `il-central-1`) | Preset ranges 24 h / 7 d / 30 d | `useAlerts` |
| **tzevaadom.co.il** (`/api/tzevaadom`) | Custom date ranges; city-ranking table | `useTzevaadomAlerts`, `useCityRankings` |

The page auto-switches to tzevaadom when the oref response hits its 3 000-item cap
(`isAtLimit = orefInDateRange.length === 3000`).

### Page-level state (all in `app/page.tsx`)

```
dateRange ('24h' | '7d' | '30d' | 'custom')
cityLabel  (Hebrew city name; empty = all)
categoryId (undefined = all)
customFrom / customTo  (ISO date strings for custom range)
activeTab  ('map' | 'charts')  ← default is 'map'
```

Data pipeline inside `page.tsx`:
```
useAlerts / useTzevaadomAlerts
  → orefAlerts / tzevaadomAlerts
    → alerts  (whichever source is active)
      → filteredAlerts  via filterAlerts()
        → chartData      via aggregateByDay()
        → timeOfDayData  via aggregateByTimeOfDay()
```

### `alertDate` formats

| Source | Format | Example |
|---|---|---|
| oref API (modes 1/2/3) | `"YYYY-MM-DDTHH:MM:SS"` | `"2026-03-18T10:00:00"` |
| oref API (mode 0 custom) | `"DD/MM/YYYY HH:MM:SS"` | `"18/03/2026 10:00:00"` |
| tzevaadom (after normalisation) | `"YYYY-MM-DDTHH:MM:SS"` | `"2026-03-18T10:00:00"` |

`lib/filter.ts` has `toDateKey()` and `toDateTimeKey()` that handle both formats.
`aggregateByTimeOfDay()` assumes the YYYY-MM-DD variant — tzevaadom data is
normalised to that format before it reaches the function.

### `getPresetDateRange` returns datetime strings, not date strings

`getPresetDateRange('24h')` returns `{ startDate: "2026-03-17T14:00", endDate: "2026-03-18T14:00" }`.
These include a `T` and a time component. `filterAlerts` detects this with
`options.startDate.includes('T')` and switches to minute-granularity comparison.
**Never assume startDate/endDate are plain `YYYY-MM-DD` strings.**

### Timestamps are Israel local time (Asia/Jerusalem)

All alert timestamps from the oref API are in Israel time, not UTC. Date comparisons
in `filterAlerts` and `aggregateByDay` use local-time string operations — they are
intentionally NOT converted to UTC. Do not add `.toISOString()` or UTC conversions.

---

## React Query setup

`ReactQueryProvider` (mounted in `app/layout.tsx`) creates a single `QueryClient`:
```ts
{ defaultOptions: { queries: { staleTime: Infinity, retry: false } } }
```

Individual hooks override defaults where needed:
- `useAlerts` — `staleTime: 0, refetchInterval: 30_000`
- `useRealtimeAlerts` — `staleTime: 0, refetchInterval: 30_000`
- `useCityRankings` (raw tzevaadom) — `staleTime: 30 * 60 * 1000`
- `useCities` (English city list) — `staleTime: Infinity`

Hook-level options always win over QueryClient defaults.

---

## Testing

### Run tests

```bash
npm test -- --watchAll=false   # run once, exit
```

Tests run with `TZ=UTC` (set in `package.json`). jsdom environment.
`ResizeObserver` and `matchMedia` are stubbed in `jest.setup.ts`.

### Every React Query hook test needs a `makeWrapper()`

Any hook that uses `useQuery` internally requires a `QueryClientProvider` in tests.
Always use this pattern:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

// Usage:
renderHook(() => useAlerts({ mode: 1 }), { wrapper: makeWrapper() })
```

Use `gcTime: 0` to prevent cached data from leaking between tests.
Use `retry: false` so failures surface immediately.

### `page.test.tsx` conventions

- All five data hooks (`useAlerts`, `useTzevaadomAlerts`, `useCities`,
  `useCategories`, `useCityRankings`) are fully mocked with `jest.mock`.
- Heavy components (`MapView`, `ByDayChart`, `TimeOfDayChart`, `CityRankingTable`)
  are also mocked to avoid Leaflet / canvas / Recharts issues in jsdom.
- **`renderPage()` clicks the "גרפים" (Charts) tab after render** because the
  default active tab is `'map'`. Tests that assert chart-section content rely on
  this. The one test that checks Map behaviour clicks the map tab itself.
- A `QueryClientProvider` is included in `renderPage()` even though hooks are
  mocked, because some components still consume the React Query context.

### Fixture dates

Test fixtures use dates in early March 2026 (`2026-03-01`, `2026-03-02`).
The system date in tests is set by Jest's `currentDate` context to `2026-03-18`.
The default `24h` preset window starts at `2026-03-17T…`, so fixture dates fall
**outside** the window and produce a count of 0 in most page-level tests. This is
intentional — tests that need in-range data construct `recentAlerts` with
`toLocalAlertDate(new Date(now - offset))`.

---

## Known pitfalls & hard-won lessons

### 1. `ChartTouchWrapper` needs `width: 100%`

`ChartTouchWrapper` wraps Recharts charts in a `position: relative` div. Recharts'
`<ResponsiveContainer width="100%">` resolves its width against the wrapper. If the
wrapper has no explicit width (and sits inside a flex container), the browser computes
its width as 0 → charts are invisible. The fix is `width: '100%'` on the wrapper div.
A regression test exists in `components/__tests__/ChartTouchWrapper.test.tsx`.

### 2. Default tab is `'map'`, not `'charts'`

`useState<'charts' | 'map'>('map')` in `page.tsx`. Any test or code that expects
chart elements to be mounted must first switch to the Charts tab.

### 3. The refresh button is gone

The manual Refresh button was removed in favour of auto-polling every 30 s.
Do not re-add it. Do not test for `getByRole('button', { name: /refresh data/i })`.

### 4. oref API returns an empty string, not `[]`, when there are no alerts

`fetchAlertHistory` handles this: `return text.trim() ? JSON.parse(text) : []`.
Do not use `res.json()` directly on the oref response.

### 5. `isAtLimit` automatic fallback to tzevaadom

If `orefInDateRange.length === 3000` (the oref API cap), `useTzevaadom` flips to
`true` and the page switches data source from oref to tzevaadom silently.
If you see charts suddenly empty on a busy day, this is why.

### 6. Double city filtering

`useAlerts` passes `city` to the API (server-side filter), AND `filteredAlerts`
re-filters client-side. Both use the Hebrew city label. For English mode, tzevaadom
data gets an `effectiveCityLabel` lookup (`enToHe` map) so the filter still works.
Do not remove either filter layer.

### 7. `staleTime: Infinity` is the QueryClient default

The app-level `QueryClient` sets `staleTime: Infinity`. This means queries that do
not declare their own `staleTime` will cache indefinitely. Always set an explicit
`staleTime` in hooks that need fresh data.

### 8. `MapView` uses dynamic imports — never SSR

`MapView` imports `RealtimeMap` and `HistoryMap` with `next/dynamic` (no SSR).
Leaflet does not work in jsdom. Always mock `MapView` in component/page tests:
```ts
jest.mock('@/components/MapView', () => ({
  MapView: () => <div data-testid="map-view">Map View</div>,
}))
```

### 9. `getPresetDateRange` is called on every render (not memoised)

This is intentional — memoising it caused `endDate` to freeze at mount time,
silently excluding newly-polled alerts. Do not wrap it in `useMemo`.

### 10. tzevaadom city name normalisation

`normalizeTzevaadomCity()` maps a handful of tzevaadom-specific spellings to the
canonical oref spellings so that city filters work across both data sources.
If a city name filter silently fails for tzevaadom data, check this map first.

---

## Documentation rule

Any commit that adds a feature, changes the architecture, adds a dependency, or
removes functionality described in `README.md` **must** update the README in the
same commit. The README is the authoritative human-readable description of the
project.

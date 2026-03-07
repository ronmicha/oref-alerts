# Precomputed City Rankings — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the in-browser parallel city fetch with a pre-computed blob so the CityRankingChart loads instantly.

**Architecture:** A GitHub Actions cron job runs every 30 minutes, fetches per-city alert data from the oref API, merges it incrementally into two Vercel Blob files (one per language), and uploads them. The app fetches the appropriate blob on load — one HTTP request instead of 1,486.

**Tech Stack:** GitHub Actions, Node.js (ESM script), `@vercel/blob`, oref API, Next.js, React Query.

---

## Data Format

Each blob (`city-rankings-he.json` / `city-rankings-en.json`) contains:

```json
{
  "generated": "2026-03-08T12:34:00Z",
  "cities": [
    {
      "label": "שדרות",
      "days": {
        "2026-02-07": 12,
        "2026-02-08": 3,
        "2026-03-08": 5
      }
    }
  ]
}
```

- Keys in `days` are ISO dates (`YYYY-MM-DD`) in `Asia/Jerusalem` time.
- Cities with zero alerts across all days are omitted.
- Data is **never pruned** — the blob accumulates all history, enabling future arbitrary date ranges.
- The client computes `today`, `last7d`, `last30d` by summing the relevant day keys.

---

## Offline Script — `scripts/precompute-city-rankings.mjs`

### Cold start (no blob exists yet)
1. Fetch city list for `he` and `en` in parallel.
2. Per-city `mode=3` (30-day history), 150 concurrent workers per language, both languages in parallel.
3. Build `days` map from `alertDate` fields (each entry's date in `Asia/Jerusalem` time).
4. Set `generated` to now.
5. Upload `city-rankings-he.json` and `city-rankings-en.json`.

### Delta run (blob already exists)
1. Download existing `city-rankings-he.json` and `city-rankings-en.json`.
2. **Archive once per day:** check if an archive for today already exists by checking for a blob prefixed `archive/YYYY-MM-DD`. If none exists, re-upload the current blob as:
   `archive/{generated-timestamp}-city-rankings-{lang}.json`
   (timestamp format: `YYYY-MM-DDTHH-MM-SSZ` so alphabetical = chronological).
3. Fetch per-city `mode=1` (today), 150 concurrent workers per language, both languages in parallel.
4. For each city, overwrite `days[today]` with the fresh count from `mode=1`.
   - Cities that appear in the new fetch but not in the blob are added.
   - Cities in the blob with no alerts today are left unchanged (their existing days remain).
5. Set `generated` to now.
6. Upload updated blobs — **only after both languages complete successfully**.

### Storage estimates (Vercel Blob free tier: 512MB)
- Blob size: ~300KB per language, grows ~10KB/day as new days accumulate.
- Archives: 1 per day × 2 languages × ~300KB = ~600KB/day → 512MB lasts 2+ years.

### Required environment variable
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read-write token, stored as a GitHub Actions secret.

### How to get the token
1. Vercel dashboard → project → **Storage** tab → **Create Database** → **Blob**.
2. Open the store → **`.env.local`** tab → copy `BLOB_READ_WRITE_TOKEN`.
3. Add to GitHub: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

---

## GitHub Actions Workflow — `.github/workflows/precompute-city-rankings.yml`

```yaml
name: Precompute City Rankings
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

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

**Billing:** 48 runs/day × ~1 min/run × 30 days = ~1,440 min/month — within the 2,000 min/month free tier. `cache: 'npm'` keeps job time under 1 minute by avoiding repeated `npm install`.

---

## App Changes

### New env var
- `NEXT_PUBLIC_BLOB_BASE_URL` — base URL of the Vercel Blob store (e.g. `https://xxxx.public.blob.vercel-storage.com`). Set in Vercel project env vars.

### New hook — `hooks/useCityRankings.ts`
Replaces `useAllCitiesAlerts`. Interface:

```ts
function useCityRankings(lang: 'he' | 'en', dateRange: 'today' | '7d' | '30d'):
  { cities: CityCount[], generated: string | null, loading: boolean, error: string | null }
```

- Fetches `${NEXT_PUBLIC_BLOB_BASE_URL}/city-rankings-{lang}.json`.
- Parses blob, computes `count` per city for the requested `dateRange`.
- Cached via React Query with `queryKey: ['cityRankings', lang]`, `staleTime: Infinity`.
- **Zero-alert cities:** if user searches a city not in the blob, hook returns a synthetic `{ label, count: 0 }`.
- Falls back gracefully on fetch error (returns empty array + error message).

### Updated `app/page.tsx`
- Replace `useAllCitiesAlerts(cityLabels, lang)` with `useCityRankings(lang, dateRange)`.
- Pass `dateRange` and `generated` to `CityRankingChart`.
- `cityLabels` still passed for the city search combobox autocomplete.

### Updated `CityRankingChart`
- Receives `dateRange` prop — selects the right count per city.
- Receives `generated: string | null` prop — displays "Last updated" label.
- **"Last updated" label:** formatted as absolute timestamp in `Asia/Jerusalem` time using `Intl.DateTimeFormat`. Shown below the chart title. Never relative (no interval needed).
  - Example: `Updated 08/03/2026, 14:34`
- **Zero-alert searched city:** shows bar at 0, rank as `—`, subtitle "No alerts in this period".

### New / updated translation keys
```json
"cityRankingUpdated": "Updated {datetime}"
```
```json
"cityRankingUpdated": "עודכן {datetime}"
```

---

## Zero-alert City Handling

| Scenario | Behavior |
|---|---|
| City has alerts in blob | Normal bar + rank |
| City in blob but 0 for selected period | Bar at 0, rank `—`, no subtitle |
| City not in blob at all (0 across all time) | Searched only: synthetic entry, bar at 0, rank `—`, subtitle "No alerts in this period" |
| No city searched, top/bottom 50 | Omitted entirely (no change from today) |

# Alerts Map — Design Document

**Date:** 2026-03-14

---

## Goal

Add an interactive map view to the app with two modes:
1. **Real-time** — live city markers updated every 30 seconds showing alerts from the last 10 minutes
2. **History** — heatmap of alert volume per city for a selected date range

---

## App Layout Redesign

Replace the current single-page layout with a **bottom tab bar** (always visible, mobile-first):

| Tab | Label (EN) | Label (HE) |
|---|---|---|
| Charts | Charts | גרפים |
| Map | Map | מפה |

- The sticky header (title, refresh, language toggle) remains on the Charts tab only
- The Map tab has its own simpler top bar (mode toggle)
- The DonateFAB remains visible on both tabs
- No close/X button on the map — the tab bar provides navigation

---

## Map View Structure

When the Map tab is active:

- **Full-screen Leaflet map** centered on Israel
- **Top bar:**
  - Toggle group: `Real-time` (זמן אמת) | `History` (היסטוריה)
- **History mode only:** date range selector (24h / 7d / 30d / custom) appears below the toggle
- **Real-time mode only:** last update badge at the bottom (`Last updated: HH:MM:SS` / `עדכון אחרון: HH:MM:SS`)

---

## Feature 1: Real-Time Alerts

**Data source:** Oref API `mode=1` (last 24h), filtered client-side to last 10 minutes

**Polling:** every 30 seconds

**City markers:** Leaflet `CircleMarker`. Painting rules:

| Alert types in last 10 min | Rendering |
|---|---|
| Flash only | Single filled circle `#E07800` |
| Missile only | Single filled circle `#E01515` |
| UAV only | Single filled circle `#7A1010` |
| Missile + UAV | Concentric rings — outer `#7A1010` (UAV), inner filled `#E01515` (Missile) |
| None | Not painted |

Colors sourced from `lib/chartColors.ts`. Flash never co-occurs with other types.

---

## Feature 2: Historical Heatmap

**Data source:** TzevaAdom (same as existing custom date range flow)

**Date range:** 24h / 7d / 30d / custom — same selector as existing FilterBar

**Rendering:** Leaflet `CircleMarker` per city, scaled by alert count:
- **Color:** green (`#22c55e`) → yellow → red (`#E01515`) linear scale
- **Radius:** 4px (min) → 18px (max), scaled to alert count
- Cities with zero alerts not painted

**No polling** — loads once per date range change. No category filter — heatmap shows total volume across all types.

---

## City Coordinates

**File:** `public/cities-geo.json`

```json
[
  { "label_he": "תל אביב - יפו", "label_en": "Tel Aviv - Jaffa", "lat": 32.0853, "lng": 34.7818 },
  ...
]
```

- ~1,300 Israeli localities
- Lookup helper: `lib/citiesGeo.ts` → `getCityCoords(name: string): { lat: number; lng: number } | null`
  - Tries Hebrew name first, then English
- **Validation script:** `scripts/validate-cities-geo.ts` — fetches live city names from Oref + TzevaAdom and reports missing entries. Run once after adding the file, not part of CI.

---

## Technical Architecture

### New dependencies
- `leaflet`
- `react-leaflet`
- `@types/leaflet`

### New files
| File | Purpose |
|---|---|
| `public/cities-geo.json` | Static city coordinates dataset |
| `lib/citiesGeo.ts` | `getCityCoords(name)` lookup |
| `scripts/validate-cities-geo.ts` | One-time validation script |
| `components/MapView.tsx` | Map tab root: mode toggle, renders Realtime or History map |
| `components/RealtimeMap.tsx` | Leaflet map with 30s polling and circle markers |
| `components/HistoryMap.tsx` | Leaflet map with heatmap rendering and date filter |
| `hooks/useRealtimeAlerts.ts` | Oref `mode=1` fetch + 30s polling |

### Changes to existing files
| File | Change |
|---|---|
| `app/page.tsx` | Add bottom tab bar; wrap existing content in Charts tab; render `MapView` in Map tab |
| `lib/translations/he.json` | Add: `מפה`, `גרפים`, `זמן אמת`, `היסטוריה`, `עדכון אחרון` |
| `lib/translations/en.json` | Add: `Map`, `Charts`, `Real-time`, `History`, `Last updated` |

### SSR
All `react-leaflet` components imported via `next/dynamic({ ssr: false })` to prevent hydration errors.

---

## Out of Scope
- City-level popup / tooltip on marker click (future)
- Filtering historical heatmap by category (future)
- Satellite / terrain tile switching (future)

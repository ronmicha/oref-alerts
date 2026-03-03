# oref-alerts — Design Document

**Date:** 2026-03-03

## Overview

A single-page web app that visualizes Israel war alert history from the Home Front Command (oref.org.il) API. Users can filter alerts by date range, district, and category, and see the results as a bar chart of alert counts per day.

---

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **i18n:** Custom context with JSON translation files (he/en)
- **Deployment:** Vercel

---

## Project Structure

```
oref-alerts/
├── app/
│   ├── layout.tsx          # Root layout with i18n provider, RTL/LTR dir
│   ├── page.tsx            # Main page (single-page app)
│   └── globals.css
├── components/
│   ├── FilterBar.tsx       # Date range + district + category selectors
│   ├── AlertChart.tsx      # Recharts bar chart (alerts per day)
│   └── LanguageToggle.tsx  # He/En switcher
├── hooks/
│   ├── useAlerts.ts        # Fetches alert history (always fresh, no cache)
│   ├── useDistricts.ts     # Fetches district list (cached in module memory)
│   └── useCategories.ts    # Fetches category list (cached in module memory)
├── lib/
│   ├── i18n.ts             # Translation context + useTranslation hook
│   ├── translations/
│   │   ├── he.json
│   │   └── en.json
│   └── oref.ts             # API base URLs + fetch helpers
└── types/
    └── oref.ts             # TypeScript types for alerts, districts, categories
```

---

## Data Sources

| Data | URL | Caching |
|------|-----|---------|
| Districts | `https://www.oref.org.il/districts/districts_heb.json` | Cached (module-level, cleared on page reload) |
| Categories | `https://www.oref.org.il/alerts/alertCategories.json` | Cached (module-level, cleared on page reload) |
| Alert history | `https://alerts-history.oref.org.il//Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=3` | **Never cached** — always fetches fresh |

Data fetching is done client-side (direct browser fetch). If CORS becomes an issue, a Next.js API route proxy can be added in `/app/api/proxy/` with minimal changes.

---

## Data Flow

1. On page load, `useDistricts` and `useCategories` fetch in parallel and store results in module-level cache.
2. `useAlerts` fetches the full past-month history on page load. The API returns up to one month of data in a single response.
3. All filtering (date range, district, category) is applied **client-side** on the raw alert data — no re-fetch on filter change.
4. Filtered data is aggregated into a per-day count array and passed to `AlertChart`.
5. When filters change, the chart re-renders from the already-fetched data.

---

## UI/UX

### Layout

```
┌─────────────────────────────────────────────────┐
│  🚨 oref alerts          [עברית | English]       │
├─────────────────────────────────────────────────┤
│  Filter Bar                                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │  Date range │ │   District   │ │ Category │  │
│  │  [7d ▼]    │ │  [All ▼]    │ │ [All ▼]  │  │
│  └─────────────┘ └──────────────┘ └──────────┘  │
├─────────────────────────────────────────────────┤
│  Summary chips                                   │
│  [ 47 alerts ]  [ Mar 1 – Mar 7 ]               │
├─────────────────────────────────────────────────┤
│                                                  │
│         Bar chart — alerts per day               │
│  ▐█                                             │
│  ▐█ █                                           │
│  ▐█ █ █  █                                      │
│  └────────────────────────────────────          │
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun         │
│  03/03 04/03 05/03 06/03 07/03 08/03 09/03       │
│                                                  │
├─────────────────────────────────────────────────┤
│  Footer: data from oref.org.il                   │
└─────────────────────────────────────────────────┘
```

### UX Decisions

- **RTL/LTR:** `dir` attribute on `<html>` switches based on active language (RTL for Hebrew, LTR for English).
- **Date range:** Preset dropdown — Today / 7 days / 14 days / 30 days. Simpler than a custom date picker for general users.
- **District & Category:** Dropdowns with an "All" option as default.
- **Summary chips:** Show total alert count and active date range at a glance.
- **X-axis labels:** Two lines — day of week on top (`Mon` / `ב'`), `DD/MM` date below. Implemented via a custom Recharts `tick` component.
- **Chart tooltip:** Hover shows exact count for that day.
- **Loading state:** Skeleton placeholders while data fetches.
- **Error state:** Inline error message if a fetch fails, with a retry button.

---

## i18n

Two JSON translation files (`he.json`, `en.json`) cover all UI strings. A `LanguageToggle` component switches the active language via React context. District and category names are returned in Hebrew by the API and displayed as-is.

---

## Out of Scope

- User accounts / authentication
- Saving/sharing filter presets
- Push notifications or real-time updates
- Mobile app

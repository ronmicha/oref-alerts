# 🚨 Lion's Roar — Israel Alert Tracker

**A real-time dashboard for tracking IDF Home Front Command (Pikud Ha'Oref) alerts — by city, category, and time of day.**

🔗 **[oref-alerts.vercel.app](https://oref-alerts.vercel.app/)**

---

## Overview

Lion's Roar visualizes the full history of Israeli home front alerts — missile fire, hostile UAV infiltrations, and more. Filter by city and alert type across multiple time ranges, and explore patterns by day and time of day.

For recent data (up to 30 days), the app pulls live from the official Oref API. For historical analysis, it draws on the tzevaadom.co.il dataset covering **May 2021 – December 2024**, enabling exploration of major events like October 7th and beyond.

## Features

- **Live & historical data** — last 24h, 7 days, 30 days, or any custom date range
- **Filter by city** — searchable combobox across all Israeli localities
- **Filter by alert type** — missiles, UAVs, flash alerts, and more
- **Alerts by Day chart** — stacked bar chart with smart label rotation for long ranges
- **Alerts by Time of Day chart** — 15-minute resolution across the full 24-hour cycle
- **Full Hebrew / English support** — RTL/LTR layout switching
- **Mobile-friendly** — responsive layout built with Tailwind CSS

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data | [Pikud Ha'Oref API](https://www.oref.org.il) · [tzevaadom.co.il](https://www.tzevaadom.co.il) |
| Hosting | Vercel |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test      # run tests
npm run build # production build
```

## Data Sources

- **Preset ranges (today / 7d / 30d):** [oref.org.il](https://www.oref.org.il) official API
- **Custom date ranges:** [tzevaadom.co.il](https://www.tzevaadom.co.il) historical archive, proxied through `/api/tzevaadom` and cached client-side for instant re-filtering

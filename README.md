# 🚨 Lion's Roar — Israel Alert Tracker

> **A real-time dashboard for tracking IDF Home Front Command (Pikud Ha'Oref) alerts — by city, category, time of day, and interactive map.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-oref--alerts.vercel.app-blue?style=for-the-badge&logo=vercel)](https://oref-alerts.vercel.app/)

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)

![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript&logoColor=white)

[![codecov](https://codecov.io/gh/ronmicha/oref-alerts/graph/badge.svg?token=ON0FIWGMOR)](https://codecov.io/gh/ronmicha/oref-alerts)

---

## 📖 Overview

Lion's Roar visualizes the full history of Israeli home front alerts — missile fire, hostile UAV infiltrations, and more. Filter by city and alert type across multiple time ranges, and explore patterns by day, time of day, and city.

For recent data (up to 30 days), the app pulls live from the official Oref API. For historical analysis, it draws on the tzevaadom.co.il dataset covering **May 2021 – present**, enabling deep exploration of major events like October 7th and beyond.

---

## ✨ Features

| | |
|---|---|
| 📅 **Live & historical data** | Last 24h, 7 days, 30 days, or any custom date range |
| 🏙️ **Filter by city** | Searchable combobox across all Israeli localities |
| 🎯 **Filter by alert type** | Missiles, UAVs, early warnings, and more |
| 📊 **Alerts by Day** | Stacked bar chart (always oldest→newest, left to right) |
| 🕐 **Alerts by Time of Day** | 15-minute resolution across the full 24-hour cycle |
| 🥇 **City Rankings** | Sortable table ranking every city by alert count, filtered by the selected date range, with city search and compare mode |
| 🗺️ **Interactive map** | Live alerts on a real-time map, or historical alert density overlaid on a map (History mode) |
| 🔁 **Automatic API fallback** | Seamlessly switches to tzevaadom when the Oref API cap is reached |
| ⏱️ **Auto-polling** | Data refreshes automatically every 30 seconds — no manual refresh needed |
| 🌐 **Hebrew / English** | Full RTL/LTR layout switching |
| 📱 **Mobile-friendly** | Responsive layout built with Tailwind CSS |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel (Next.js)                           │
│                                                                 │
│  ┌─────────────────┐        ┌──────────────────────────────┐   │
│  │   React Client  │        │     Next.js API Routes       │   │
│  │                 │        │  /api/tzevaadom  (proxy +    │   │
│  │  hooks/         │        │   cache headers)             │   │
│  │  useAlerts      │        └──────────────┬───────────────┘   │
│  │  useCityRankings│                       │                   │
│  │  useTzevaadomAlerts                     │                   │
│  └────────┬────────┘                       │                   │
│           │ fetch (NEXT_PUBLIC_OREF_PROXY) │                   │
└───────────┼────────────────────────────────┼───────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐      ┌─────────────────────────────┐
│   AWS API Gateway     │      │      tzevaadom.co.il        │
│   + Lambda            │      │  /static/historical/all.json│
│   (il-central-1 🇮🇱)   │      │  (May 2021 – present)       │
│                       │      └─────────────────────────────┘
│  Israeli IP ✓         │
│  No geo-block         │
└───────────┬───────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     oref.org.il                                 │
│          Official IDF Home Front Command API                    │
│   /GetAlarmsHistory  ·  /GetCitiesMix  ·  /alertCategories      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data fetching | TanStack React Query v5 |
| Oref proxy | AWS Lambda + API Gateway (`il-central-1`) |
| Data | [Pikud Ha'Oref API](https://www.oref.org.il) · [tzevaadom.co.il](https://www.tzevaadom.co.il) |
| Hosting | Vercel |
| Analytics | Vercel Web Analytics (`@vercel/analytics`) |

---

## 🚀 Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test       # run tests
npm run build  # production build
```

---

## 🗄️ Data Sources

- 🔴 **Preset ranges (24h / 7d / 30d)** — [oref.org.il](https://www.oref.org.il) official API, routed through an AWS Lambda proxy in `il-central-1` (Israeli IP, bypasses geo-block)
- 🗓️ **Custom date ranges** — [tzevaadom.co.il](https://www.tzevaadom.co.il) historical archive, proxied through `/api/tzevaadom` and cached client-side for instant re-filtering

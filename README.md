# 🚨 Lion's Roar — Israel Alert Tracker

> **A real-time dashboard for tracking IDF Home Front Command (Pikud Ha'Oref) alerts — by city, category, and time of day.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-oref--alerts.vercel.app-blue?style=for-the-badge&logo=vercel)](https://oref-alerts.vercel.app/)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript&logoColor=white)

---

## 📖 Overview

Lion's Roar visualizes the full history of Israeli home front alerts — missile fire, hostile UAV infiltrations, and more. Filter by city and alert type across multiple time ranges, and explore patterns by day and time of day.

For recent data (up to 30 days), the app pulls live from the official Oref API. For historical analysis, it draws on the tzevaadom.co.il dataset covering **May 2021 – December 2024**, enabling deep exploration of major events like October 7th and beyond.

---

## ✨ Features

| | |
|---|---|
| 📅 **Live & historical data** | Last 24h, 7 days, 30 days, or any custom date range |
| 🏙️ **Filter by city** | Searchable combobox across all Israeli localities |
| 🎯 **Filter by alert type** | Missiles, UAVs, flash alerts, and more |
| 📊 **Alerts by Day** | Stacked bar chart (always oldest→newest, left to right) |
| 🕐 **Alerts by Time of Day** | 15-minute resolution across the full 24-hour cycle |
| 🥇 **City Rankings** | Sortable table ranking every city by alert count since Feb 28 2026, with city search |
| 🔁 **Automatic API fallback** | Seamlessly switches to tzevaadom when the Oref API cap is reached |
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
│  │  useTzevaadom   │                       │                   │
│  └────────┬────────┘                       │                   │
│           │ fetch (NEXT_PUBLIC_OREF_PROXY) │                   │
└───────────┼────────────────────────────────┼───────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐      ┌─────────────────────────────┐
│   AWS API Gateway     │      │      tzevaadom.co.il        │
│   + Lambda            │      │  /static/historical/all.json│
│   (il-central-1 🇮🇱)   │      │  (May 2021 – Dec 2024)      │
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

**Data flow by date range:**

| Range | Alert data | Why |
|---|---|---|
| Last 24h / 7d / 30d | Oref API (via Lambda proxy) | Live, official data |
| Last 24h / 7d / 30d — if Oref returns 3,000 results (cap hit) | tzevaadom archive | Oref result is partial/misleading |
| Custom date range | tzevaadom archive | Oref API only goes back 30 days |
| City Rankings (since Feb 28 2026) | Oref API (via Lambda proxy) | Dedicated precomputed endpoint |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Oref proxy | AWS Lambda + API Gateway (`il-central-1`) |
| Data | [Pikud Ha'Oref API](https://www.oref.org.il) · [tzevaadom.co.il](https://www.tzevaadom.co.il) |
| Hosting | Vercel |

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

- 🔴 **Preset ranges (today / 7d / 30d)** — [oref.org.il](https://www.oref.org.il) official API, routed through an AWS Lambda proxy in `il-central-1` (Israeli IP, bypasses geo-block)
- 🗓️ **Custom date ranges** — [tzevaadom.co.il](https://www.tzevaadom.co.il) historical archive, proxied through `/api/tzevaadom` and cached client-side for instant re-filtering

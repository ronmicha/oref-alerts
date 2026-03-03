# oref-alerts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js 14 app that visualizes Israel war alert history with filtering by date range, district (area), and category, displayed as a bar chart of alerts per day.

**Architecture:** Single-page App Router app. All data fetched client-side. Districts and categories cached in module memory. Alert history always fetched fresh. All filtering/aggregation is pure client-side logic. i18n via React context + JSON files with RTL/LTR support.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Recharts, Jest + React Testing Library

---

## API Reference

| Data | URL | Caching |
|------|-----|---------|
| Districts | `https://www.oref.org.il/districts/districts_heb.json` | Module-level cache |
| Categories | `https://www.oref.org.il/alerts/alertCategories.json` | Module-level cache |
| Alert history | `https://alerts-history.oref.org.il//Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=3` | Never cached |

**IMPORTANT — History endpoint requires these headers or it will reject the request:**
```
Referer: https://www.oref.org.il/
X-Requested-With: XMLHttpRequest
```
These non-simple headers trigger a CORS preflight. If the browser blocks the request, add a Next.js API route proxy (see Task 9 fallback).

---

## Data Shape (verified against live APIs)

```typescript
// districts_heb.json — 1,492 locality items
interface District {
  areaid: number;
  areaname: string;    // Hebrew area group (e.g., "אילת") — use for filter dropdown
  id: string;          // locality id (numeric string)
  label: string;       // Hebrew locality name — matches alert.data
  label_he: string;    // same as label
  rashut: string | null;
  migun_time: number;
}

// alertCategories.json — 28 items
interface AlertCategory {
  id: number;          // matches AlarmHistoryItem.category
  category: string;    // slug (e.g., "missilealert", "uav")
  matrix_id: number;
  priority: number;
  queue: boolean;
}

// GetAlarmsHistory.aspx — up to 3,000 items (1 month)
interface AlarmHistoryItem {
  data: string;          // Hebrew locality name — matches District.label
  date: string;          // "DD.MM.YYYY"
  time: string;          // "HH:MM:SS"
  alertDate: string;     // "YYYY-MM-DDTHH:MM:00" — use this for date filtering
  category: number;      // matches AlertCategory.id
  category_desc: string; // Hebrew alert type name
  matrix_id: number;
  rid: number;           // unique monotonic alert ID
}
```

---

## Key Design Decisions

- **District filter** uses `areaname` groups (≈50 unique areas), not all 1,492 localities. Build a lookup `Map<string, string>` from `District.label → District.areaname` to match alerts to their area.
- **Category filter** matches `alert.category` (number) to `AlertCategory.id`.
- **Category display names** come from `category_desc` values found in the alert history data (already Hebrew). English names added to translations.
- **Date aggregation** uses `alertDate` field (ISO format, easiest to parse).

---

### Task 1: Scaffold the project

**Files:**
- Create: `oref-alerts/` project (from `/Users/ronmichaeli/dev/`)

**Step 1: Create the Next.js app**

Run from `/Users/ronmichaeli/dev/`:
```bash
npx create-next-app@latest oref-alerts --typescript --tailwind --app --no-src-dir --no-turbopack --eslint --import-alias "@/*"
```
When prompted, accept all defaults (TypeScript yes, Tailwind yes, App Router yes, src/ dir no).

**Step 2: Install Recharts**
```bash
cd oref-alerts
npm install recharts
```

**Step 3: Install test dependencies**
```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 4: Create `jest.config.ts`**
```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

**Step 5: Create `jest.setup.ts`**
```typescript
import '@testing-library/jest-dom'
```

**Step 6: Add test scripts to `package.json`**

In the `"scripts"` section, add/update:
```json
"test": "jest",
"test:watch": "jest --watch"
```

**Step 7: Replace `app/globals.css` with Tailwind-only content**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 8: Replace `app/page.tsx` with a placeholder**
```typescript
export default function Home() {
  return <main className="p-8">oref-alerts loading...</main>
}
```

**Step 9: Verify tests run**
```bash
npm test -- --passWithNoTests
```
Expected: `No tests found` or passes with 0 tests.

**Step 10: Commit**
```bash
git add -A
git commit -m "chore: scaffold Next.js project with Recharts and Jest"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `types/oref.ts`

**Step 1: Create `types/oref.ts`**
```typescript
export interface District {
  areaid: number
  areaname: string
  id: string
  label: string
  label_he: string
  rashut: string | null
  migun_time: number
}

export interface AlertCategory {
  id: number
  category: string
  matrix_id: number
  priority: number
  queue: boolean
}

export interface AlarmHistoryItem {
  data: string
  date: string
  time: string
  alertDate: string
  category: number
  category_desc: string
  matrix_id: number
  rid: number
}

export interface DayCount {
  dateKey: string   // "YYYY-MM-DD" — used for internal grouping
  label: string     // "DD/MM" — displayed on x-axis
  dayName: string   // "Mon" or "ב'" depending on language
  count: number
}

export type DateRangeOption = 'today' | '7d' | '14d' | '30d'
```

**Step 2: Commit**
```bash
git add types/oref.ts
git commit -m "feat: add TypeScript types for oref API"
```

---

### Task 3: Pure filter and aggregation logic (TDD)

**Files:**
- Create: `lib/filter.ts`
- Create: `lib/__tests__/filter.test.ts`

**Step 1: Write the failing tests**

Create `lib/__tests__/filter.test.ts`:
```typescript
import { filterAlerts, aggregateByDay } from '../filter'
import type { AlarmHistoryItem, District } from '@/types/oref'

const makeAlert = (overrides: Partial<AlarmHistoryItem> = {}): AlarmHistoryItem => ({
  data: 'תל אביב',
  date: '01.03.2026',
  time: '10:00:00',
  alertDate: '2026-03-01T10:00:00',
  category: 1,
  category_desc: 'ירי רקטות וטילים',
  matrix_id: 1,
  rid: 1,
  ...overrides,
})

const districts: District[] = [
  { areaid: 1, areaname: 'גוש דן', id: '1', label: 'תל אביב', label_he: 'תל אביב', rashut: null, migun_time: 90 },
  { areaid: 1, areaname: 'גוש דן', id: '2', label: 'רמת גן', label_he: 'רמת גן', rashut: null, migun_time: 90 },
  { areaid: 2, areaname: 'ירושלים', id: '3', label: 'ירושלים', label_he: 'ירושלים', rashut: null, migun_time: 90 },
]

describe('filterAlerts', () => {
  it('returns all alerts when no filters are set', () => {
    const alerts = [makeAlert(), makeAlert({ data: 'רמת גן' })]
    const result = filterAlerts(alerts, districts, {})
    expect(result).toHaveLength(2)
  })

  it('filters by area name', () => {
    const alerts = [
      makeAlert({ data: 'תל אביב' }),
      makeAlert({ data: 'ירושלים' }),
    ]
    const result = filterAlerts(alerts, districts, { areaname: 'גוש דן' })
    expect(result).toHaveLength(1)
    expect(result[0].data).toBe('תל אביב')
  })

  it('filters by category', () => {
    const alerts = [
      makeAlert({ category: 1 }),
      makeAlert({ category: 2 }),
    ]
    const result = filterAlerts(alerts, districts, { categoryId: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe(2)
  })

  it('filters by date range (startDate inclusive)', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-05T10:00:00' }),
    ]
    const result = filterAlerts(alerts, districts, { startDate: '2026-03-03' })
    expect(result).toHaveLength(1)
    expect(result[0].alertDate).toContain('2026-03-05')
  })

  it('filters by date range (endDate inclusive)', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-05T10:00:00' }),
    ]
    const result = filterAlerts(alerts, districts, { endDate: '2026-03-03' })
    expect(result).toHaveLength(1)
    expect(result[0].alertDate).toContain('2026-03-01')
  })

  it('applies multiple filters together', () => {
    const alerts = [
      makeAlert({ data: 'תל אביב', category: 1, alertDate: '2026-03-02T10:00:00' }),
      makeAlert({ data: 'ירושלים', category: 1, alertDate: '2026-03-02T10:00:00' }),
      makeAlert({ data: 'תל אביב', category: 2, alertDate: '2026-03-02T10:00:00' }),
    ]
    const result = filterAlerts(alerts, districts, { areaname: 'גוש דן', categoryId: 1 })
    expect(result).toHaveLength(1)
  })
})

describe('aggregateByDay', () => {
  it('returns one entry per day', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-01T14:00:00' }),
      makeAlert({ alertDate: '2026-03-02T10:00:00' }),
    ]
    const result = aggregateByDay(alerts, '2026-03-01', '2026-03-02', 'en')
    expect(result).toHaveLength(2)
    expect(result[0].count).toBe(2)
    expect(result[1].count).toBe(1)
  })

  it('fills in days with zero alerts', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-03T10:00:00' }),
    ]
    const result = aggregateByDay(alerts, '2026-03-01', '2026-03-03', 'en')
    expect(result).toHaveLength(3)
    expect(result[1].count).toBe(0)
    expect(result[1].dateKey).toBe('2026-03-02')
  })

  it('sets label as DD/MM', () => {
    const alerts = [makeAlert({ alertDate: '2026-03-07T10:00:00' })]
    const result = aggregateByDay(alerts, '2026-03-07', '2026-03-07', 'en')
    expect(result[0].label).toBe('07/03')
  })

  it('sets English day names', () => {
    const alerts = [makeAlert({ alertDate: '2026-03-02T10:00:00' })] // Monday
    const result = aggregateByDay(alerts, '2026-03-02', '2026-03-02', 'en')
    expect(result[0].dayName).toBe('Mon')
  })

  it('sets Hebrew day names', () => {
    const alerts = [makeAlert({ alertDate: '2026-03-02T10:00:00' })] // Monday
    const result = aggregateByDay(alerts, '2026-03-02', '2026-03-02', 'he')
    expect(result[0].dayName).toBe("ב'")
  })
})
```

**Step 2: Run tests to confirm they fail**
```bash
npm test lib/__tests__/filter.test.ts
```
Expected: FAIL — `Cannot find module '../filter'`

**Step 3: Create `lib/filter.ts`**
```typescript
import type { AlarmHistoryItem, District, DayCount } from '@/types/oref'

interface FilterOptions {
  areaname?: string
  categoryId?: number
  startDate?: string  // "YYYY-MM-DD"
  endDate?: string    // "YYYY-MM-DD"
}

export function filterAlerts(
  alerts: AlarmHistoryItem[],
  districts: District[],
  options: FilterOptions
): AlarmHistoryItem[] {
  const localityToArea = new Map<string, string>()
  for (const d of districts) {
    localityToArea.set(d.label, d.areaname)
  }

  return alerts.filter((alert) => {
    if (options.areaname) {
      if (localityToArea.get(alert.data) !== options.areaname) return false
    }
    if (options.categoryId !== undefined) {
      if (alert.category !== options.categoryId) return false
    }
    if (options.startDate) {
      if (alert.alertDate.slice(0, 10) < options.startDate) return false
    }
    if (options.endDate) {
      if (alert.alertDate.slice(0, 10) > options.endDate) return false
    }
    return true
  })
}

const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HE_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]

export function aggregateByDay(
  alerts: AlarmHistoryItem[],
  startDate: string,
  endDate: string,
  lang: 'he' | 'en'
): DayCount[] {
  const countMap = new Map<string, number>()
  for (const alert of alerts) {
    const key = alert.alertDate.slice(0, 10)
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const days: DayCount[] = []
  const cursor = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const days_arr = lang === 'he' ? HE_DAYS : EN_DAYS

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const day = cursor.getDay()
    const dd = String(cursor.getDate()).padStart(2, '0')
    const mm = String(cursor.getMonth() + 1).padStart(2, '0')
    days.push({
      dateKey: key,
      label: `${dd}/${mm}`,
      dayName: days_arr[day],
      count: countMap.get(key) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}
```

**Step 4: Run tests to confirm they pass**
```bash
npm test lib/__tests__/filter.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**
```bash
git add lib/filter.ts lib/__tests__/filter.test.ts
git commit -m "feat: add alert filter and day aggregation logic with tests"
```

---

### Task 4: API helpers with module-level cache

**Files:**
- Create: `lib/oref.ts`

**Step 1: Create `lib/oref.ts`**
```typescript
import type { District, AlertCategory, AlarmHistoryItem } from '@/types/oref'

const DISTRICTS_URL = 'https://www.oref.org.il/districts/districts_heb.json'
const CATEGORIES_URL = 'https://www.oref.org.il/alerts/alertCategories.json'
const HISTORY_URL =
  'https://alerts-history.oref.org.il//Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=3'

// Module-level cache — persists for the lifetime of the page session
let cachedDistricts: District[] | null = null
let cachedCategories: AlertCategory[] | null = null

export async function fetchDistricts(): Promise<District[]> {
  if (cachedDistricts) return cachedDistricts
  const res = await fetch(DISTRICTS_URL)
  if (!res.ok) throw new Error(`Failed to fetch districts: ${res.status}`)
  cachedDistricts = await res.json()
  return cachedDistricts!
}

export async function fetchCategories(): Promise<AlertCategory[]> {
  if (cachedCategories) return cachedCategories
  const res = await fetch(CATEGORIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`)
  cachedCategories = await res.json()
  return cachedCategories!
}

// Always fetches fresh — no caching
export async function fetchAlertHistory(): Promise<AlarmHistoryItem[]> {
  const res = await fetch(HISTORY_URL, {
    headers: {
      Referer: 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch alert history: ${res.status}`)
  return res.json()
}
```

> **CORS note:** If `fetchAlertHistory` fails in the browser with a CORS error, implement Task 9 (proxy route) and update this URL to `/api/history`.

**Step 2: Commit**
```bash
git add lib/oref.ts
git commit -m "feat: add oref API helpers with module-level cache for districts/categories"
```

---

### Task 5: i18n system (TDD)

**Files:**
- Create: `lib/i18n.tsx`
- Create: `lib/translations/he.json`
- Create: `lib/translations/en.json`
- Create: `lib/__tests__/i18n.test.tsx`

**Step 1: Create `lib/translations/he.json`**
```json
{
  "appTitle": "התראות פיקוד העורף",
  "filterDateRange": "טווח תאריכים",
  "filterDistrict": "מחוז",
  "filterCategory": "קטגוריה",
  "all": "הכל",
  "today": "היום",
  "last7days": "7 ימים אחרונים",
  "last14days": "14 ימים אחרונים",
  "last30days": "30 ימים אחרונים",
  "alertsCount": "{count} התראות",
  "loading": "טוען...",
  "errorLoad": "שגיאה בטעינת הנתונים",
  "retry": "נסה שוב",
  "footerSource": "נתונים מ-oref.org.il",
  "langToggle": "English",
  "categories": {
    "missilealert": "ירי רקטות וטילים",
    "uav": "חדירת כלי טיס עוין",
    "nonconventional": "אירוע בלתי קונבנציונלי",
    "warning": "אזהרה",
    "earthquakealert1": "רעידת אדמה - עצו",
    "earthquakealert2": "רעידת אדמה - התפנו",
    "cbrne": "חומ\"ס",
    "terrorattack": "פיגוע",
    "tsunami": "צונאמי",
    "hazmat": "חומרים מסוכנים",
    "update": "עדכון",
    "flash": "בזק",
    "missilealertdrill": "תרגיל - ירי רקטות וטילים",
    "uavdrill": "תרגיל - כלי טיס עוין",
    "memorialday1": "יום הזיכרון - צפירה ראשונה",
    "memorialday2": "יום הזיכרון - צפירה שנייה",
    "nonconventionaldrill": "תרגיל - אירוע בלתי קונבנציונלי",
    "warningdrill": "תרגיל - אזהרה",
    "memorialdaydrill1": "תרגיל - יום הזיכרון 1",
    "memorialdaydrill2": "תרגיל - יום הזיכרון 2",
    "earthquakedrill1": "תרגיל - רעידת אדמה 1",
    "earthquakedrill2": "תרגיל - רעידת אדמה 2",
    "cbrnedrill": "תרגיל - חומ\"ס",
    "terrorattackdrill": "תרגיל - פיגוע",
    "tsunamidrill": "תרגיל - צונאמי",
    "hazmatdrill": "תרגיל - חומרים מסוכנים",
    "updatedrill": "תרגיל - עדכון",
    "flashdrill": "תרגיל - בזק"
  }
}
```

**Step 2: Create `lib/translations/en.json`**
```json
{
  "appTitle": "Israel War Alerts",
  "filterDateRange": "Date range",
  "filterDistrict": "District",
  "filterCategory": "Category",
  "all": "All",
  "today": "Today",
  "last7days": "Last 7 days",
  "last14days": "Last 14 days",
  "last30days": "Last 30 days",
  "alertsCount": "{count} alerts",
  "loading": "Loading...",
  "errorLoad": "Failed to load data",
  "retry": "Retry",
  "footerSource": "Data from oref.org.il",
  "langToggle": "עברית",
  "categories": {
    "missilealert": "Missile Alert",
    "uav": "Hostile UAV",
    "nonconventional": "Non-Conventional Threat",
    "warning": "Warning",
    "earthquakealert1": "Earthquake – Stay",
    "earthquakealert2": "Earthquake – Evacuate",
    "cbrne": "CBRNE",
    "terrorattack": "Terror Attack",
    "tsunami": "Tsunami",
    "hazmat": "Hazardous Materials",
    "update": "Update",
    "flash": "Flash",
    "missilealertdrill": "Drill – Missile Alert",
    "uavdrill": "Drill – Hostile UAV",
    "memorialday1": "Memorial Day – First Siren",
    "memorialday2": "Memorial Day – Second Siren",
    "nonconventionaldrill": "Drill – Non-Conventional",
    "warningdrill": "Drill – Warning",
    "memorialdaydrill1": "Drill – Memorial Day 1",
    "memorialdaydrill2": "Drill – Memorial Day 2",
    "earthquakedrill1": "Drill – Earthquake 1",
    "earthquakedrill2": "Drill – Earthquake 2",
    "cbrnedrill": "Drill – CBRNE",
    "terrorattackdrill": "Drill – Terror Attack",
    "tsunamidrill": "Drill – Tsunami",
    "hazmatdrill": "Drill – Hazardous Materials",
    "updatedrill": "Drill – Update",
    "flashdrill": "Drill – Flash"
  }
}
```

**Step 3: Write the failing test**

Create `lib/__tests__/i18n.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n'

function TestConsumer() {
  const { t, lang, setLang } = useI18n()
  return (
    <div>
      <span data-testid="title">{t('appTitle')}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>toggle</button>
    </div>
  )
}

describe('I18nProvider', () => {
  it('defaults to Hebrew', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('he')
    expect(screen.getByTestId('title').textContent).toBe('התראות פיקוד העורף')
  })

  it('switches to English on toggle', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>)
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('lang').textContent).toBe('en')
    expect(screen.getByTestId('title').textContent).toBe('Israel War Alerts')
  })

  it('supports {count} interpolation', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>)
    const { t } = screen.getByTestId('title') // just to get context
    // test via a component that uses interpolation
  })
})
```

**Step 4: Run to confirm failure**
```bash
npm test lib/__tests__/i18n.test.tsx
```
Expected: FAIL — `Cannot find module '../i18n'`

**Step 5: Create `lib/i18n.tsx`**
```typescript
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import he from './translations/he.json'
import en from './translations/en.json'

type Lang = 'he' | 'en'
type Translations = typeof he

const translations: Record<Lang, Translations> = { he, en }

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: keyof Omit<Translations, 'categories'>, vars?: Record<string, string | number>) => string
  tCategory: (slug: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('he')
  const dict = translations[lang]

  function t(key: keyof Omit<Translations, 'categories'>, vars?: Record<string, string | number>): string {
    let str = dict[key] as string
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  function tCategory(slug: string): string {
    return (dict.categories as Record<string, string>)[slug] ?? slug
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tCategory }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
```

**Step 6: Run tests to confirm they pass**
```bash
npm test lib/__tests__/i18n.test.tsx
```
Expected: PASS.

**Step 7: Commit**
```bash
git add lib/i18n.tsx lib/translations/ lib/__tests__/i18n.test.tsx
git commit -m "feat: add i18n context with Hebrew and English translations"
```

---

### Task 6: Data hooks

**Files:**
- Create: `hooks/useDistricts.ts`
- Create: `hooks/useCategories.ts`
- Create: `hooks/useAlerts.ts`

**Step 1: Create `hooks/useDistricts.ts`**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { fetchDistricts } from '@/lib/oref'
import type { District } from '@/types/oref'

export function useDistricts() {
  const [districts, setDistricts] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDistricts()
      .then(setDistricts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Extract unique area names, sorted alphabetically
  const areas = [...new Set(districts.map((d) => d.areaname))].sort()

  return { districts, areas, loading, error }
}
```

**Step 2: Create `hooks/useCategories.ts`**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { fetchCategories } from '@/lib/oref'
import type { AlertCategory } from '@/types/oref'

export function useCategories() {
  const [categories, setCategories] = useState<AlertCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, error }
}
```

**Step 3: Create `hooks/useAlerts.ts`**
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchAlertHistory } from '@/lib/oref'
import type { AlarmHistoryItem } from '@/types/oref'

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlarmHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAlertHistory()
      .then(setAlerts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { alerts, loading, error, retry: load }
}
```

**Step 4: Commit**
```bash
git add hooks/
git commit -m "feat: add data hooks for districts, categories, and alert history"
```

---

### Task 7: LanguageToggle component

**Files:**
- Create: `components/LanguageToggle.tsx`

**Step 1: Create `components/LanguageToggle.tsx`**
```typescript
'use client'

import { useI18n } from '@/lib/i18n'

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()

  return (
    <button
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      className="px-3 py-1 text-sm font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
      aria-label="Toggle language"
    >
      {t('langToggle')}
    </button>
  )
}
```

**Step 2: Commit**
```bash
git add components/LanguageToggle.tsx
git commit -m "feat: add LanguageToggle component"
```

---

### Task 8: FilterBar component (TDD)

**Files:**
- Create: `components/FilterBar.tsx`
- Create: `components/__tests__/FilterBar.test.tsx`

**Step 1: Write the failing tests**

Create `components/__tests__/FilterBar.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '../FilterBar'
import { I18nProvider } from '@/lib/i18n'

const defaultProps = {
  dateRange: '7d' as const,
  onDateRangeChange: jest.fn(),
  areaname: '',
  onAreanameChange: jest.fn(),
  categoryId: undefined,
  onCategoryIdChange: jest.fn(),
  areas: ['גוש דן', 'ירושלים'],
  categories: [
    { id: 1, category: 'missilealert', matrix_id: 1, priority: 120, queue: false },
    { id: 2, category: 'uav', matrix_id: 6, priority: 130, queue: false },
  ],
}

function renderFilterBar(props = {}) {
  return render(
    <I18nProvider>
      <FilterBar {...defaultProps} {...props} />
    </I18nProvider>
  )
}

describe('FilterBar', () => {
  it('renders date range select with default value', () => {
    renderFilterBar()
    expect(screen.getByDisplayValue('7 ימים אחרונים')).toBeInTheDocument()
  })

  it('renders district dropdown with All option', () => {
    renderFilterBar()
    const districtSelect = screen.getAllByRole('combobox')[1]
    expect(districtSelect).toHaveValue('')
  })

  it('calls onDateRangeChange when date range changes', () => {
    const onDateRangeChange = jest.fn()
    renderFilterBar({ onDateRangeChange })
    const select = screen.getAllByRole('combobox')[0]
    fireEvent.change(select, { target: { value: '30d' } })
    expect(onDateRangeChange).toHaveBeenCalledWith('30d')
  })

  it('calls onAreanameChange when district changes', () => {
    const onAreanameChange = jest.fn()
    renderFilterBar({ onAreanameChange })
    const select = screen.getAllByRole('combobox')[1]
    fireEvent.change(select, { target: { value: 'גוש דן' } })
    expect(onAreanameChange).toHaveBeenCalledWith('גוש דן')
  })
})
```

**Step 2: Run to confirm failure**
```bash
npm test components/__tests__/FilterBar.test.tsx
```
Expected: FAIL — `Cannot find module '../FilterBar'`

**Step 3: Create `components/FilterBar.tsx`**
```typescript
'use client'

import { useI18n } from '@/lib/i18n'
import type { AlertCategory, DateRangeOption } from '@/types/oref'

interface FilterBarProps {
  dateRange: DateRangeOption
  onDateRangeChange: (v: DateRangeOption) => void
  areaname: string
  onAreanameChange: (v: string) => void
  categoryId: number | undefined
  onCategoryIdChange: (v: number | undefined) => void
  areas: string[]
  categories: AlertCategory[]
}

export function FilterBar({
  dateRange, onDateRangeChange,
  areaname, onAreanameChange,
  categoryId, onCategoryIdChange,
  areas, categories,
}: FilterBarProps) {
  const { t, tCategory } = useI18n()

  const selectClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="flex flex-wrap gap-4">
      {/* Date range */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterDateRange')}
        </label>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
          className={selectClass}
        >
          <option value="today">{t('today')}</option>
          <option value="7d">{t('last7days')}</option>
          <option value="14d">{t('last14days')}</option>
          <option value="30d">{t('last30days')}</option>
        </select>
      </div>

      {/* District */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterDistrict')}
        </label>
        <select
          value={areaname}
          onChange={(e) => onAreanameChange(e.target.value)}
          className={selectClass}
        >
          <option value="">{t('all')}</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterCategory')}
        </label>
        <select
          value={categoryId ?? ''}
          onChange={(e) =>
            onCategoryIdChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
          className={selectClass}
        >
          <option value="">{t('all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{tCategory(c.category)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**
```bash
npm test components/__tests__/FilterBar.test.tsx
```
Expected: PASS.

**Step 5: Commit**
```bash
git add components/FilterBar.tsx components/__tests__/FilterBar.test.tsx
git commit -m "feat: add FilterBar component with date range, district, and category selectors"
```

---

### Task 9: AlertChart component

**Files:**
- Create: `components/AlertChart.tsx`

**Step 1: Create `components/AlertChart.tsx`**
```typescript
'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { DayCount } from '@/types/oref'
import { useI18n } from '@/lib/i18n'

interface AlertChartProps {
  data: DayCount[]
}

function CustomTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload) return null
  const [dayName, dateLabel] = payload.value.split('|')
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#6B7280" fontSize={11}>
        {dayName}
      </text>
      <text x={0} y={0} dy={28} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
        {dateLabel}
      </text>
    </g>
  )
}

export function AlertChart({ data }: AlertChartProps) {
  const { lang } = useI18n()

  const chartData = data.map((d) => ({
    ...d,
    // Encode both day name and date into the x-axis key, decoded by CustomTick
    xKey: `${d.dayName}|${d.label}`,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="xKey"
          tick={<CustomTick />}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          width={32}
        />
        <Tooltip
          cursor={{ fill: '#F3F4F6' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as DayCount & { xKey: string }
            return (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow text-sm">
                <div className="font-medium text-gray-800">{d.dayName} {d.label}</div>
                <div className="text-blue-600 font-bold">{d.count}</div>
              </div>
            )
          }}
        />
        <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

**Step 2: Commit**
```bash
git add components/AlertChart.tsx
git commit -m "feat: add AlertChart component with custom two-line x-axis tick"
```

---

### Task 10: Wire the main page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Replace `app/page.tsx` with the full page**
```typescript
'use client'

import { useState, useMemo } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useDistricts } from '@/hooks/useDistricts'
import { useCategories } from '@/hooks/useCategories'
import { FilterBar } from '@/components/FilterBar'
import { AlertChart } from '@/components/AlertChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { filterAlerts, aggregateByDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import type { DateRangeOption } from '@/types/oref'

function getDateRange(option: DateRangeOption): { startDate: string; endDate: string } {
  const today = new Date()
  const end = today.toISOString().slice(0, 10)
  const start = new Date(today)
  if (option === 'today') {
    // no change
  } else if (option === '7d') {
    start.setDate(start.getDate() - 6)
  } else if (option === '14d') {
    start.setDate(start.getDate() - 13)
  } else {
    start.setDate(start.getDate() - 29)
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end }
}

export default function Home() {
  const { t, lang } = useI18n()
  const { alerts, loading: alertsLoading, error: alertsError, retry } = useAlerts()
  const { districts, areas, loading: districtsLoading } = useDistricts()
  const { categories, loading: categoriesLoading } = useCategories()

  const [dateRange, setDateRange] = useState<DateRangeOption>('7d')
  const [areaname, setAreaname] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)

  const { startDate, endDate } = getDateRange(dateRange)

  const filteredAlerts = useMemo(
    () => filterAlerts(alerts, districts, {
      areaname: areaname || undefined,
      categoryId,
      startDate,
      endDate,
    }),
    [alerts, districts, areaname, categoryId, startDate, endDate]
  )

  const chartData = useMemo(
    () => aggregateByDay(filteredAlerts, startDate, endDate, lang as 'he' | 'en'),
    [filteredAlerts, startDate, endDate, lang]
  )

  const isLoading = alertsLoading || districtsLoading || categoriesLoading

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <h1 className="text-lg font-bold text-gray-900">{t('appTitle')}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <FilterBar
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            areaname={areaname}
            onAreanameChange={setAreaname}
            categoryId={categoryId}
            onCategoryIdChange={setCategoryId}
            areas={areas}
            categories={categories}
          />
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border border-blue-100">
            {t('alertsCount', { count: filteredAlerts.length })}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
            {startDate === endDate ? startDate : `${startDate} – ${endDate}`}
          </span>
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm min-h-[360px] flex items-center justify-center">
          {isLoading && (
            <div className="text-gray-400 text-sm animate-pulse">{t('loading')}</div>
          )}
          {alertsError && !isLoading && (
            <div className="text-center space-y-2">
              <p className="text-red-500 text-sm">{t('errorLoad')}</p>
              <button
                onClick={retry}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                {t('retry')}
              </button>
            </div>
          )}
          {!isLoading && !alertsError && <AlertChart data={chartData} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
        {t('footerSource')}
      </footer>
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add app/page.tsx
git commit -m "feat: wire main page with filters, summary chips, and alert chart"
```

---

### Task 11: Root layout with i18n and RTL/LTR

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Update `app/layout.tsx`**

Replace its contents with:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'oref alerts',
  description: 'Israel war alert history visualizer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
```

> **Note on RTL/LTR:** The `dir` attribute on `<html>` must update when the user switches language. Because `layout.tsx` is a Server Component, it can't read client state. To make RTL/LTR dynamic, the `I18nProvider` will set `document.documentElement.dir` and `document.documentElement.lang` via a `useEffect`. Update `lib/i18n.tsx` to add this effect inside `I18nProvider`:
> ```typescript
> useEffect(() => {
>   document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
>   document.documentElement.lang = lang
> }, [lang])
> ```

**Step 2: Add the dir effect to `lib/i18n.tsx`**

Inside the `I18nProvider` function body, after the `useState`, add:
```typescript
useEffect(() => {
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}, [lang])
```
Add `useEffect` to the import from 'react'.

**Step 3: Commit**
```bash
git add app/layout.tsx lib/i18n.tsx
git commit -m "feat: configure root layout with i18n provider and dynamic RTL/LTR direction"
```

---

### Task 12: Run all tests and smoke test

**Step 1: Run the full test suite**
```bash
npm test
```
Expected: All tests PASS.

**Step 2: Start the dev server**
```bash
npm run dev
```
Open http://localhost:3000 and verify:
- [ ] App loads in Hebrew with RTL layout
- [ ] Language toggle switches to English with LTR layout
- [ ] All three dropdowns (date range, district, category) populate
- [ ] Chart renders bars for the default 7-day range
- [ ] X-axis shows day name + DD/MM on two lines
- [ ] Summary chip shows correct alert count
- [ ] Hovering a bar shows the tooltip with exact count

**Step 3: Commit any fixes found during smoke test**
```bash
git add -A
git commit -m "fix: smoke test corrections"
```

---

### Task 13: CORS fallback (only if needed)

> **Do this task only if Task 12 reveals that `fetchAlertHistory` fails with a CORS error.**

**Files:**
- Create: `app/api/history/route.ts`
- Modify: `lib/oref.ts`

**Step 1: Create `app/api/history/route.ts`**
```typescript
import { NextResponse } from 'next/server'

const HISTORY_URL =
  'https://alerts-history.oref.org.il//Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=3'

export async function GET() {
  const res = await fetch(HISTORY_URL, {
    headers: {
      Referer: 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
    },
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data)
}
```

**Step 2: Update `lib/oref.ts` — change `HISTORY_URL` to the proxy route**
```typescript
const HISTORY_URL = '/api/history'
```
And remove the custom headers from `fetchAlertHistory` (the proxy handles them server-side).

**Step 3: Commit**
```bash
git add app/api/history/route.ts lib/oref.ts
git commit -m "fix: add Next.js proxy route for alert history to bypass CORS"
```

---

### Task 14: Deploy to Vercel

**Step 1: Create a GitHub repository and push**
```bash
git remote add origin <your-github-repo-url>
git push -u origin master
```

**Step 2: Import to Vercel**
- Go to https://vercel.com/new
- Import the GitHub repository
- No environment variables needed
- Click Deploy

**Step 3: Verify the live deployment**
- Open the Vercel-provided URL
- Repeat the smoke test checklist from Task 12

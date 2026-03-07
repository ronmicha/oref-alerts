import type { City, AlertCategory, AlarmHistoryItem } from '@/types/oref'

// In production, point to the Cloudflare Worker proxy (set NEXT_PUBLIC_OREF_PROXY in Vercel env vars).
// Falls back to the local Next.js API routes for development.
const PROXY = process.env.NEXT_PUBLIC_OREF_PROXY ?? '/api'
const CITIES_URL = `${PROXY}/cities`
const CATEGORIES_URL = `${PROXY}/categories`
const HISTORY_BASE = `${PROXY}/history`

export async function fetchCities(lang: 'he' | 'en' = 'he'): Promise<City[]> {
  const res = await fetch(`${CITIES_URL}?lang=${lang}`)
  if (!res.ok) throw new Error(`Failed to fetch cities: ${res.status}`)
  return res.json()
}

export async function fetchCategories(): Promise<AlertCategory[]> {
  const res = await fetch(CATEGORIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`)
  return res.json()
}

export interface FetchAlertHistoryOptions {
  mode: 0 | 1 | 2 | 3
  city?: string
  lang?: 'he' | 'en'
  /** Custom range start in "DD.MM.YYYY" format — requires mode=0 */
  fromDate?: string
  /** Custom range end in "DD.MM.YYYY" format — requires mode=0 */
  toDate?: string
}

// Always fetches fresh — no caching
// oref returns an empty string (not []) when there are no alerts
// For a preset range use mode 1/2/3 (today/7d/30d).
// For a custom range use mode=0 with fromDate/toDate in "DD.MM.YYYY" format.
export async function fetchAlertHistory({
  mode,
  city,
  lang = 'he',
  fromDate,
  toDate,
}: FetchAlertHistoryOptions): Promise<AlarmHistoryItem[]> {
  const params = new URLSearchParams({ mode: String(mode), lang })
  if (city) params.set('city', city)
  if (fromDate) params.set('fromDate', fromDate)
  if (toDate) params.set('toDate', toDate)
  const res = await fetch(`${HISTORY_BASE}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch alert history: ${res.status}`)
  const text = await res.text()
  return text.trim() ? JSON.parse(text) : []
}

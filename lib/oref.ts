import type { City, AlertCategory, AlarmHistoryItem } from '@/types/oref'

// In production, point to the Cloudflare Worker proxy (set NEXT_PUBLIC_OREF_PROXY in Vercel env vars).
// Falls back to the local Next.js API routes for development.
const PROXY = process.env.NEXT_PUBLIC_OREF_PROXY ?? '/api'
const CITIES_URL = `${PROXY}/cities`
const CATEGORIES_URL = `${PROXY}/categories`
const HISTORY_BASE = `${PROXY}/history`

// Module-level cache — persists for the lifetime of the page session
const cachedCities = new Map<string, City[]>()  // keyed by lang
let cachedCategories: AlertCategory[] | null = null

export async function fetchCities(lang: 'he' | 'en' = 'he'): Promise<City[]> {
  if (cachedCities.has(lang)) return cachedCities.get(lang)!
  const res = await fetch(`${CITIES_URL}?lang=${lang}`)
  if (!res.ok) throw new Error(`Failed to fetch cities: ${res.status}`)
  const data: City[] = await res.json()
  cachedCities.set(lang, data)
  return data
}

export async function fetchCategories(): Promise<AlertCategory[]> {
  if (cachedCategories) return cachedCategories
  const res = await fetch(CATEGORIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`)
  cachedCategories = await res.json()
  return cachedCategories!
}

// Always fetches fresh — no caching
// oref returns an empty string (not []) when there are no alerts
// For a preset range use mode 1/2/3 (today/7d/30d).
// For a custom range use mode=0 with fromDate/toDate in "DD.MM.YYYY" format.
export async function fetchAlertHistory(
  mode: 0 | 1 | 2 | 3,
  city?: string,
  lang: 'he' | 'en' = 'he',
  fromDate?: string,
  toDate?: string,
): Promise<AlarmHistoryItem[]> {
  const params = new URLSearchParams({ mode: String(mode), lang })
  if (city) params.set('city', city)
  if (fromDate) params.set('fromDate', fromDate)
  if (toDate) params.set('toDate', toDate)
  const res = await fetch(`${HISTORY_BASE}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch alert history: ${res.status}`)
  const text = await res.text()
  return text.trim() ? JSON.parse(text) : []
}

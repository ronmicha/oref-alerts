import type { City, AlertCategory, AlarmHistoryItem } from '@/types/oref'

// Call oref directly from the browser — avoids Cloudflare datacenter blocks
// that affect server-side proxies (Vercel, etc.)
const CITIES_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx'
const CATEGORIES_URL = 'https://www.oref.org.il/alerts/alertCategories.json'
const HISTORY_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

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
export async function fetchAlertHistory(mode: 1 | 2 | 3, city?: string, lang: 'he' | 'en' = 'he'): Promise<AlarmHistoryItem[]> {
  const params = new URLSearchParams({ mode: String(mode), lang })
  if (city) params.set('city_0', city)
  const res = await fetch(`${HISTORY_BASE}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch alert history: ${res.status}`)
  const text = await res.text()
  return text.trim() ? JSON.parse(text) : []
}

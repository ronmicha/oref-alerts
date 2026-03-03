import type { City, AlertCategory, AlarmHistoryItem } from '@/types/oref'

const CITIES_URL = '/api/cities'
const CATEGORIES_URL = '/api/categories'
const HISTORY_BASE = '/api/history'

// Module-level cache — persists for the lifetime of the page session
let cachedCities: City[] | null = null
let cachedCategories: AlertCategory[] | null = null

export async function fetchCities(): Promise<City[]> {
  if (cachedCities) return cachedCities
  const res = await fetch(CITIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch cities: ${res.status}`)
  cachedCities = await res.json()
  return cachedCities!
}

export async function fetchCategories(): Promise<AlertCategory[]> {
  if (cachedCategories) return cachedCategories
  const res = await fetch(CATEGORIES_URL)
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`)
  cachedCategories = await res.json()
  return cachedCategories!
}

// Always fetches fresh — no caching
export async function fetchAlertHistory(mode: 1 | 2 | 3, city?: string): Promise<AlarmHistoryItem[]> {
  const params = new URLSearchParams({ mode: String(mode) })
  if (city) params.set('city', city)
  const res = await fetch(`${HISTORY_BASE}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch alert history: ${res.status}`)
  return res.json()
}

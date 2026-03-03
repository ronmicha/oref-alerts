import type { District, AlertCategory, AlarmHistoryItem } from '@/types/oref'

const DISTRICTS_URL = '/api/districts'
const CATEGORIES_URL = '/api/categories'
const HISTORY_URL = '/api/history'

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
  const res = await fetch(HISTORY_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch alert history: ${res.status}`)
  return res.json()
}

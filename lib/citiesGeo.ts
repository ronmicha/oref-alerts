import citiesGeoRaw from '@/public/cities-geo.json'

export interface CityGeoEntry {
  label_he: string
  label_en: string
  lat: number
  lng: number
}

const citiesGeo: CityGeoEntry[] = citiesGeoRaw as CityGeoEntry[]

// Build lookup maps for O(1) access
const byHe = new Map<string, CityGeoEntry>()
const byEn = new Map<string, CityGeoEntry>()

for (const entry of citiesGeo) {
  byHe.set(entry.label_he, entry)
  byEn.set(entry.label_en, entry)
}

/**
 * Returns lat/lng for a city by name.
 * Tries Hebrew name first (exact match), then English name (exact match).
 * Returns null if not found.
 */
export function getCityCoords(name: string): { lat: number; lng: number } | null {
  const entry = byHe.get(name) ?? byEn.get(name)
  return entry ? { lat: entry.lat, lng: entry.lng } : null
}

/**
 * Returns the full CityGeoEntry for a city by name.
 * Tries Hebrew name first (exact match), then English name (exact match).
 * Returns null if not found.
 */
export function getCityEntry(name: string): CityGeoEntry | null {
  return byHe.get(name) ?? byEn.get(name) ?? null
}

export { citiesGeo }

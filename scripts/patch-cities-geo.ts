/**
 * Patches cities-geo.json with sub-city districts and compound localities
 * that are in the Oref city list but missing from the geo file.
 *
 * Strategy:
 *   - Sub-city districts ("City - District"): use parent city coords
 *   - Compound localities ("City1, City2" / "City1 וCity2"): use first city coords
 *   - Falls back to Nominatim if no existing entry matches
 *
 * Usage:
 *   npx tsx scripts/patch-cities-geo.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const CITIES_URL_HE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=HE'
const CITIES_URL_EN = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=EN'

interface OrefCity { label: string; id: string }

interface CityGeoEntry {
  label_he: string
  label_en: string
  lat: number
  lng: number
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchCities(lang: 'HE' | 'EN'): Promise<OrefCity[]> {
  const res = await fetch(lang === 'HE' ? CITIES_URL_HE : CITIES_URL_EN, {
    headers: { Referer: 'https://www.oref.org.il/', 'User-Agent': 'oref-alerts-geocoder/1.0' },
  })
  if (!res.ok) throw new Error(`Failed to fetch (${lang}): ${res.status}`)
  return res.json()
}

async function geocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${name}, Israel`)
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=il`
    const res = await fetch(url, { headers: { 'User-Agent': 'oref-alerts-geocoder/1.0' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

/** Extract a candidate lookup key from a sub-city district label. */
function parentFromDistrict(label: string): string | null {
  const idx = label.indexOf(' - ')
  if (idx === -1) return null
  // "חדרה כל - האזורים" → take part before " - " trimmed, then first word if needed
  const before = label.slice(0, idx).trim()
  // If before is "X כל" (the word כל after the city), strip it
  return before.replace(/\s+כל$/, '').trim()
}

/** Extract candidate lookup keys from a compound locality. */
function firstCityFromCompound(label: string): string[] {
  // Split on comma, " ו", " וה", " והה"
  const parts = label.split(/,|,| ו(?=[^\s]| )/)
  return parts.map((p) => p.trim()).filter(Boolean)
}

function isDistrict(label: string): boolean {
  return label.includes(' - ')
}

function isCompound(label: string): boolean {
  return label.includes(',') || /\bו[^\s]/.test(label) || / ו /.test(label)
}

async function main() {
  const geoPath = path.join(process.cwd(), 'public', 'cities-geo.json')
  const existing: CityGeoEntry[] = JSON.parse(fs.readFileSync(geoPath, 'utf8'))
  const byHe = new Map<string, CityGeoEntry>(existing.map((e) => [e.label_he, e]))

  /** Lookup by exact name, then shortest startsWith match */
  function lookupHe(name: string): CityGeoEntry | null {
    if (byHe.has(name)) return byHe.get(name)!
    // Find all entries whose label starts with the name (followed by space/comma/dash)
    const matches = existing.filter((e) =>
      e.label_he.startsWith(name + ' ') ||
      e.label_he.startsWith(name + ',') ||
      e.label_he.startsWith(name + '-')
    )
    if (!matches.length) return null
    // Prefer shortest (most generic)
    return matches.reduce((a, b) => a.label_he.length <= b.label_he.length ? a : b)
  }

  console.log(`Loaded ${existing.length} existing entries`)

  console.log('Fetching Oref city lists...')
  const [heCities, enCities] = await Promise.all([fetchCities('HE'), fetchCities('EN')])
  const enById = new Map<string, string>(enCities.map((c) => [c.id, c.label]))

  // Find all missing cities
  const missing = heCities.filter((c) => !byHe.has(c.label))

  // Keep only sub-city districts and compound localities
  const targets = missing.filter((c) => isDistrict(c.label) || isCompound(c.label))

  console.log(`${targets.length} targets to patch (districts + compounds)`)

  const added: CityGeoEntry[] = []
  const failed: string[] = []

  for (let i = 0; i < targets.length; i++) {
    const city = targets[i]
    const labelHe = city.label
    const labelEn = enById.get(city.id) ?? labelHe

    process.stdout.write(`[${i + 1}/${targets.length}] ${labelHe} ... `)

    // 1. Try resolving from existing geo entries
    let coords: { lat: number; lng: number } | null = null

    let nominatimQuery: string | null = null

    if (isDistrict(labelHe)) {
      const parent = parentFromDistrict(labelHe)
      if (parent) {
        coords = lookupHe(parent)
        if (!coords) nominatimQuery = parent
      }
    }

    if (!coords && isCompound(labelHe)) {
      const candidates = firstCityFromCompound(labelHe)
      for (const c of candidates) {
        const found = lookupHe(c)
        if (found) { coords = found; break }
      }
      if (!coords) nominatimQuery = firstCityFromCompound(labelHe)[0] ?? labelHe
    }

    // 2. Fall back to Nominatim using the most specific sub-query
    if (!coords) {
      const query = nominatimQuery ?? labelHe
      coords = await geocode(query)
      await sleep(1100)
      if (!coords && query !== labelEn) {
        coords = await geocode(labelEn.split(',')[0].split('-')[0].trim())
        await sleep(1100)
      }
    }

    if (coords) {
      const entry: CityGeoEntry = { label_he: labelHe, label_en: labelEn, lat: coords.lat, lng: coords.lng }
      added.push(entry)
      byHe.set(labelHe, entry) // so later entries can reference it
      console.log(`OK (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`)
    } else {
      failed.push(`${labelHe} / ${labelEn}`)
      console.log('FAILED')
    }
  }

  // Write updated file, deduplicating by label_he
  const seen = new Set<string>(existing.map((e) => e.label_he))
  const deduped = added.filter((e) => !seen.has(e.label_he) && seen.add(e.label_he))
  const updated = [...existing, ...deduped]
  fs.writeFileSync(geoPath, JSON.stringify(updated, null, 2), 'utf8')

  console.log(`\nAdded ${added.length} entries → ${updated.length} total in ${geoPath}`)
  if (failed.length) {
    console.warn(`\nFailed (${failed.length}):`)
    failed.forEach((f) => console.warn('  -', f))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

/**
 * One-time geocoding script.
 * Fetches all Israeli cities from Oref, geocodes each via Nominatim, writes public/cities-geo.json.
 *
 * Usage:
 *   npx tsx scripts/generate-cities-geo.ts
 *
 * Nominatim rate limit: 1 req/sec — the script respects this automatically.
 * On first run expect ~20-30 minutes for ~1,300 cities.
 */

import * as fs from 'fs'
import * as path from 'path'

const CITIES_URL_HE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=HE'
const CITIES_URL_EN = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=EN'

interface OrefCity {
  label: string
  value: string
  id: string
  areaid: number
  color: string
  migun_time: number
  rashut: string
  label_he: string
}

interface CityGeoEntry {
  label_he: string
  label_en: string
  lat: number
  lng: number
}

async function fetchCities(lang: 'HE' | 'EN'): Promise<OrefCity[]> {
  const url = lang === 'HE' ? CITIES_URL_HE : CITIES_URL_EN
  const res = await fetch(url, {
    headers: { 'Referer': 'https://www.oref.org.il/', 'User-Agent': 'oref-alerts-geocoder/1.0' },
  })
  if (!res.ok) throw new Error(`Failed to fetch cities (${lang}): ${res.status}`)
  return res.json()
}

async function geocode(name: string, lang: 'he' | 'en'): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${name},Israel`)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=${lang}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'oref-alerts-geocoder/1.0 (https://github.com/your-repo)',
      'Accept-Language': lang,
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data || data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('Fetching Hebrew city list...')
  const heCities = await fetchCities('HE')
  console.log(`Got ${heCities.length} Hebrew cities`)

  console.log('Fetching English city list...')
  const enCities = await fetchCities('EN')
  console.log(`Got ${enCities.length} English cities`)

  // Build id → English label map
  const enById = new Map<string, string>(enCities.map((c) => [c.id, c.label]))

  const results: CityGeoEntry[] = []
  const failed: string[] = []

  for (let i = 0; i < heCities.length; i++) {
    const city = heCities[i]
    const labelEn = enById.get(city.id) ?? city.label_he
    const labelHe = city.label

    process.stdout.write(`[${i + 1}/${heCities.length}] Geocoding: ${labelHe} ... `)

    // Try Hebrew name first
    let coords = await geocode(labelHe, 'he')
    await sleep(1100) // Nominatim rate limit: 1 req/sec

    if (!coords && labelEn !== labelHe) {
      coords = await geocode(labelEn, 'en')
      await sleep(1100)
    }

    if (coords) {
      results.push({ label_he: labelHe, label_en: labelEn, lat: coords.lat, lng: coords.lng })
      console.log(`OK (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`)
    } else {
      failed.push(`${labelHe} / ${labelEn}`)
      console.log('FAILED')
    }
  }

  const outPath = path.join(process.cwd(), 'public', 'cities-geo.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')

  console.log(`\nWrote ${results.length} entries to ${outPath}`)
  if (failed.length > 0) {
    console.warn(`\nFailed to geocode ${failed.length} cities:`)
    failed.forEach((f) => console.warn('  -', f))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

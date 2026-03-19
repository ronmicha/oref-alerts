/**
 * geocode-missing-cities.mjs
 *
 * Geocodes cities that are missing from cities-geo.json using the Geoapify API.
 * Uses a bounding box covering Israel + West Bank/Jordan Valley so settlements
 * outside the Green Line are found correctly.
 *
 * After geocoding, validates coordinates against the city's oref areaid region
 * (same rules as validate-cities-geo.mjs) before adding to the file.
 *
 * Usage:
 *   GEOAPIFY_KEY=<key> node scripts/geocode-missing-cities.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GEO_PATH = resolve(__dirname, '../public/cities-geo.json')
const DRY_RUN = process.argv.includes('--dry-run')

const API_KEY = process.env.GEOAPIFY_KEY
if (!API_KEY) { console.error('Set GEOAPIFY_KEY env var'); process.exit(1) }

// Bounding box: Israel + West Bank + Gaza + Golan
// rect: minLon,minLat,maxLon,maxLat
const ISRAEL_BBOX = '34.2,29.3,35.9,33.4'

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/', Origin: 'https://www.oref.org.il',
  'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/javascript, */*; q=0.01',
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function isValidForArea(lat, lng, areaid) {
  if (lat > 33.5 || lat < 29.0) return false
  if (areaid === 3  && lng < 35.1)  return false
  if (areaid === 10 && lng < 34.9)  return false
  if (areaid === 17 && lng < 34.85) return false
  return true
}

async function geoapify(query) {
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&filter=rect:${ISRAEL_BBOX}&limit=1&apiKey=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.features?.length > 0) {
    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat, lng }
  }
  return null
}

async function geocode(labelHe, labelEn) {
  // Try queries from most to least specific
  const queries = []
  if (labelHe) queries.push(labelHe + ' ישראל')
  if (labelEn) queries.push(labelEn + ' Israel')
  if (labelHe) queries.push(labelHe)
  if (labelEn) queries.push(labelEn)

  // Strip common prefixes for fallback
  const noPrefix = (s, prefix) => s?.startsWith(prefix) ? s.slice(prefix.length).trim() : null
  const baseHe = noPrefix(labelHe, 'אזור תעשייה ')
    ?? noPrefix(labelHe, 'חוות ')
    ?? noPrefix(labelHe, 'צומת ')
  const baseEn = labelEn?.replace(/^(industrial (zone|area|park)|havat|junction)\s+/i, '').trim()
  if (baseHe) queries.push(baseHe + ' ישראל')
  if (baseEn) queries.push(baseEn + ' Israel')

  for (const q of [...new Set(queries)]) {
    const coords = await geoapify(q)
    await sleep(200) // Geoapify free tier: 5 req/s
    if (coords) return coords
  }
  return null
}

async function main() {
  // Fetch full oref city list with areaid + English label
  const [resHe, resEn] = await Promise.all([
    fetch('https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=he', { headers: OREF_HEADERS }),
    fetch('https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=en', { headers: OREF_HEADERS }),
  ])
  const citiesHe = JSON.parse(await resHe.text())
  const citiesEn = JSON.parse(await resEn.text())

  const areaByName  = new Map(citiesHe.map((c) => [c.label_he || c.label, c.areaid]))
  const enByName    = new Map(citiesEn.map((c) => [c.label_he || '', c.label || '']))

  // Find cities missing from geo file
  const geo = JSON.parse(readFileSync(GEO_PATH, 'utf8'))
  const existingNames = new Set(geo.map((e) => e.label_he))

  const seen = new Set()
  const missing = []
  for (const c of citiesHe) {
    const name = c.label_he || c.label
    if (!name || seen.has(name) || existingNames.has(name)) continue
    seen.add(name)
    missing.push({ label_he: name, label_en: enByName.get(name) || '', areaid: areaByName.get(name) })
  }
  console.log(`Missing cities to geocode: ${missing.length}\n`)

  const added = []
  const failed = []

  for (let i = 0; i < missing.length; i++) {
    const { label_he, label_en, areaid } = missing[i]
    process.stdout.write(`[${i + 1}/${missing.length}] ${label_he}… `)
    try {
      const coords = await geocode(label_he, label_en)
      if (!coords) {
        console.log('✗ not found')
        failed.push({ label_he, label_en })
        continue
      }
      if (!isValidForArea(coords.lat, coords.lng, areaid)) {
        console.log(`✗ invalid region (areaid=${areaid}, got ${coords.lat.toFixed(4)},${coords.lng.toFixed(4)})`)
        failed.push({ label_he, label_en })
        continue
      }
      console.log(`✓ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
      added.push({ label_he, label_en, lat: coords.lat, lng: coords.lng })
    } catch (err) {
      console.log(`✗ error: ${err.message}`)
      failed.push({ label_he, label_en })
    }
  }

  console.log(`\nAdded: ${added.length} | Failed/skipped: ${failed.length}`)

  if (failed.length > 0) {
    console.log('\nNot geocoded:')
    for (const { label_he, label_en } of failed) {
      console.log(`  - ${label_he} / ${label_en}`)
    }
  }

  if (!DRY_RUN && added.length > 0) {
    const merged = [...geo, ...added].sort((a, b) => a.label_he.localeCompare(b.label_he, 'he'))
    writeFileSync(GEO_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8')
    console.log(`\n✅ cities-geo.json updated: ${merged.length} entries (+${added.length} added)`)
  } else if (DRY_RUN) {
    console.log('\n(dry-run — no changes written)')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

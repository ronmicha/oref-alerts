/**
 * geocode-missing-cities.mjs
 *
 * Geocodes cities missing from cities-geo.json using the Geoapify API.
 *
 * Key strategies:
 *   1. Restrict result type to city/locality/district — avoids matching streets
 *   2. For compound "X - direction" names, try geocoding just X first
 *   3. Use per-areaid bounding box as filter so West Bank/Jordan Valley
 *      settlements aren't confused with same-named places inside Israel
 *   4. Validate coordinates against areaid region after geocoding
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

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/', Origin: 'https://www.oref.org.il',
  'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/javascript, */*; q=0.01',
}

// Per-areaid bounding boxes for geocoding filter [minLon, minLat, maxLon, maxLat]
// Wider than validation boxes to allow finding nearby results
const AREA_GEOCODE_BBOX = {
  1:  [34.7, 29.3, 35.2, 30.2],  // Eilat
  2:  [35.4, 32.5, 36.1, 33.5],  // Golan
  3:  [35.0, 31.5, 35.9, 32.7],  // Jordan Valley
  4:  [35.0, 32.1, 35.9, 32.9],  // Jezreel/Gilboa
  5:  [34.6, 31.3, 35.5, 32.3],  // Judean foothills
  6:  [34.7, 32.4, 35.9, 33.4],  // Western Galilee
  7:  [34.6, 32.4, 35.7, 33.3],  // Haifa coastal / Galilee
  8:  [34.6, 31.8, 35.1, 32.4],  // Dan / Tel Aviv
  9:  [34.2, 29.4, 35.6, 31.6],  // Negev
  10: [34.8, 31.6, 35.7, 32.7],  // Samaria / West Bank North
  11: [34.7, 32.4, 35.2, 33.0],  // Carmel coastal
  12: [34.5, 31.5, 35.2, 32.2],  // Shfela central
  13: [34.7, 32.0, 35.2, 32.7],  // Sharon North
  14: [34.4, 31.3, 35.2, 32.1],  // Southern Lowlands
  15: [34.7, 32.1, 35.3, 32.8],  // Hadera
  16: [34.2, 30.7, 35.0, 31.7],  // Be'er Sheva South
  17: [34.8, 31.0, 35.7, 32.1],  // Judea / West Bank South
  18: [35.0, 30.5, 35.8, 32.0],  // Dead Sea
  19: [34.3, 31.4, 34.9, 32.2],  // Ashkelon / South Coast
  20: [34.9, 31.5, 35.5, 32.1],  // Jerusalem
  21: [34.7, 31.7, 35.2, 32.3],  // Lod / Ramle
  22: [34.3, 31.2, 35.1, 32.1],  // Shfela South / Lachish
  23: [34.6, 31.9, 35.1, 32.7],  // Sharon / Coastal Plain
  24: [34.8, 32.5, 35.3, 33.1],  // Carmel Mountains
  25: [34.3, 30.8, 35.2, 31.7],  // Be'er Sheva / Negev North
  26: [34.1, 31.0, 34.9, 31.8],  // Gaza Envelope
  27: [34.7, 32.0, 35.2, 32.7],  // Sharon / Coastal North
  29: [34.5, 29.3, 35.4, 31.0],  // Arava
  30: [34.8, 32.9, 35.8, 33.5],  // Upper Galilee
  34: [34.8, 32.6, 35.3, 33.1],  // Haifa
  35: [35.4, 32.5, 36.1, 33.2],  // Sea of Galilee / North Jordan Valley
  36: [34.8, 32.5, 35.4, 33.1],  // Haifa suburbs
  37: [34.9, 32.3, 35.8, 33.0],  // Lower Galilee / Jezreel
}

// Broader Israel+territories bbox as fallback
const ISRAEL_BBOX = '34.2,29.3,35.9,33.4'

// Direction words to strip from compound names
const DIRECTION_SUFFIXES = /\s*[-–]\s*(צפון|דרום|מזרח|מערב|מרכז|כל האזורים|צפון מזרח|צפון מערב|דרום מזרח|דרום מערב|אזור תעשייה עטרות|כפר עקב|גילה|פסגת זאב|קטמון|ארמון הנציב|מלחה|טלביה|בית וגן|נווה יעקב|ענתות|גבעת זאב)$/

// Per-areaid validation bbox [minLat, minLng, maxLat, maxLng]
const AREA_VALIDATE_BBOX = {
  1:  [29.4, 34.7, 30.1, 35.1],
  3:  [31.6, 35.1, 32.6, 35.9],
  8:  [31.9, 34.7, 32.3, 35.0],
  10: [31.7, 34.9, 32.6, 35.6],
  17: [31.1, 34.85, 32.0, 35.6],
  18: [30.6, 35.1, 31.9, 35.7],
  20: [31.6, 35.0, 32.0, 35.5],
  22: [31.3, 34.4, 32.0, 35.1],
  26: [31.1, 34.2, 31.7, 34.8],
  29: [29.4, 34.6, 30.9, 35.3],
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function inBbox(lat, lng, bbox) {
  return lat >= bbox[0] && lat <= bbox[2] && lng >= bbox[1] && lng <= bbox[3]
}

function isValidForArea(lat, lng, areaid) {
  if (lat > 33.5 || lat < 29.0) return false
  const bbox = AREA_VALIDATE_BBOX[areaid]
  if (bbox && !inBbox(lat, lng, bbox)) return false
  return true
}

async function geoapify(query, bboxFilter, placeType) {
  const filter = bboxFilter ? `rect:${bboxFilter}` : `rect:${ISRAEL_BBOX}`
  const typeParam = placeType ? `&type=${placeType}` : ''
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&filter=${filter}${typeParam}&limit=1&apiKey=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  await sleep(220) // ~4.5 req/s within free tier
  if (data.features?.length > 0) {
    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat, lng }
  }
  return null
}

function buildQueries(labelHe, labelEn, areaid) {
  const queries = []

  // 1. For "X - direction" compound names, try base city first (more reliable)
  const baseHe = labelHe?.replace(DIRECTION_SUFFIXES, '').trim()
  const baseEn = labelEn?.replace(/\s*[-–]\s*(north|south|east|west|center|all areas|industrial zone)[^,]*/i, '').trim()
  if (baseHe && baseHe !== labelHe) {
    queries.push({ q: baseHe, type: 'city' })
    queries.push({ q: baseHe, type: 'locality' })
    if (baseEn && baseEn !== labelEn) {
      queries.push({ q: baseEn, type: 'city' })
      queries.push({ q: baseEn, type: 'locality' })
    }
  }

  // 2. Full Hebrew name
  queries.push({ q: labelHe, type: 'city' })
  queries.push({ q: labelHe, type: 'locality' })
  // 3. Full English name
  if (labelEn) {
    queries.push({ q: labelEn, type: 'city' })
    queries.push({ q: labelEn, type: 'locality' })
  }

  // 4. Strip common Hebrew prefixes and retry
  const prefixes = ['אזור תעשייה ', 'חוות ', 'צומת ', 'מרכז אזורי ', 'פארק תעשייה ']
  for (const p of prefixes) {
    if (labelHe?.startsWith(p)) {
      const stripped = labelHe.slice(p.length).trim()
      queries.push({ q: stripped, type: 'city' })
      queries.push({ q: stripped, type: 'locality' })
      break
    }
  }

  // 5. Last resort: same queries without type restriction
  queries.push({ q: baseHe && baseHe !== labelHe ? baseHe : labelHe, type: undefined })
  if (labelEn) queries.push({ q: baseEn && baseEn !== labelEn ? baseEn : labelEn, type: undefined })

  return [...new Map(queries.map((q) => [q.q + '|' + q.type, q])).values()]
}

async function geocode(labelHe, labelEn, areaid) {
  const bbox = AREA_GEOCODE_BBOX[areaid]
  const bboxStr = bbox ? `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}` : null
  const queries = buildQueries(labelHe, labelEn, areaid)

  for (const { q, type } of queries) {
    const coords = await geoapify(q, bboxStr, type)
    if (coords && isValidForArea(coords.lat, coords.lng, areaid)) return coords
    // Also try without areaid bbox constraint if typed query found nothing
    if (!coords && bboxStr && type) {
      const coords2 = await geoapify(q, null, type)
      if (coords2 && isValidForArea(coords2.lat, coords2.lng, areaid)) return coords2
    }
  }
  return null
}

async function main() {
  const [resHe, resEn] = await Promise.all([
    fetch('https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=he', { headers: OREF_HEADERS }),
    fetch('https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=en', { headers: OREF_HEADERS }),
  ])
  const citiesHe = JSON.parse(await resHe.text())
  const citiesEn = JSON.parse(await resEn.text())
  const areaByName = new Map(citiesHe.map((c) => [c.label_he || c.label, c.areaid]))
  const enByName   = new Map(citiesEn.map((c) => [c.label_he || '', c.label || '']))

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
      const coords = await geocode(label_he, label_en, areaid)
      if (coords) {
        console.log(`✓ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        added.push({ label_he, label_en, lat: coords.lat, lng: coords.lng })
      } else {
        console.log('✗ not found')
        failed.push({ label_he, label_en })
      }
    } catch (err) {
      console.log(`✗ ${err.message}`)
      failed.push({ label_he, label_en })
    }
  }

  console.log(`\nAdded: ${added.length} | Failed: ${failed.length}`)
  if (failed.length) {
    console.log('\nNot geocoded:')
    failed.forEach(({ label_he, label_en }) => console.log(`  - ${label_he} / ${label_en}`))
  }

  if (!DRY_RUN && added.length > 0) {
    const merged = [...geo, ...added].sort((a, b) => a.label_he.localeCompare(b.label_he, 'he'))
    writeFileSync(GEO_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8')
    console.log(`\n✅ cities-geo.json: ${merged.length} entries (+${added.length})`)
  } else if (DRY_RUN) {
    console.log('\n(dry-run)')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

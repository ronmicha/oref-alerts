/**
 * sync-cities-geo.mjs
 *
 * Fetches the canonical oref city list, compares against public/cities-geo.json,
 * geocodes missing cities via Nominatim, and writes an updated cities-geo.json.
 *
 * Geocoding strategies (tried in order for each city):
 *   1. English label as-is
 *   2. Hebrew label as-is
 *   3. Strip common prefixes/suffixes (industrial zone, farm, old area, junction)
 *   4. For compound "X and Y" names — try just the first part
 *
 * Usage:
 *   node scripts/sync-cities-geo.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GEO_PATH = resolve(__dirname, '../public/cities-geo.json')

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/',
  Origin: 'https://www.oref.org.il',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
}
const NOMINATIM_UA = 'oref-alerts-sync/1.0 (github.com/ronmicha/oref-alerts)'

const CITIES_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang='

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchWithRetry(url, options, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      return res
    } catch (err) {
      if (attempt === retries) throw err
      console.log(`  [retry ${attempt}/${retries - 1}] ${err.code || err.message}`)
      await sleep(delayMs * attempt)
    }
  }
}

async function fetchOrefCities(lang) {
  const res = await fetchWithRetry(CITIES_URL + lang, { headers: OREF_HEADERS })
  return JSON.parse(await res.text())
}

/**
 * Build a list of search queries to try for a given city, from most to least specific.
 */
function buildQueries(labelHe, labelEn) {
  const queries = []

  // 1. English label as-is
  if (labelEn) queries.push(labelEn)

  // 2. Hebrew label as-is
  if (labelHe) queries.push(labelHe)

  // 3. Strip "(Previous alert area)" / "(אזור התרעה ישן)"
  const stripped = labelEn?.replace(/\s*\(previous alert area\)/i, '').trim()
  if (stripped && stripped !== labelEn) queries.push(stripped)

  const strippedHe = labelHe?.replace(/\s*\(אזור התרעה ישן\)/, '').trim()
  if (strippedHe && strippedHe !== labelHe) queries.push(strippedHe)

  // 4. Strip "Industrial Zone" / "אזור תעשייה"
  const noIndustrial = labelEn?.replace(/^[^a-zA-Z\u05D0-\u05EA]*industrial\s*(zone|area|park)[^a-zA-Z\u05D0-\u05EA]*/i, '').trim()
  if (noIndustrial && noIndustrial !== labelEn) queries.push(noIndustrial)

  const noIndustrialHe = labelHe?.replace(/^אזור תעשייה\s+/, '').trim()
  if (noIndustrialHe && noIndustrialHe !== labelHe) queries.push(noIndustrialHe)

  // 5. Strip "Farm" / "חוות" / "Havat"
  const noFarm = labelEn?.replace(/^havat\s+/i, '').trim()
  if (noFarm && noFarm !== labelEn) queries.push(noFarm)

  const noFarmHe = labelHe?.replace(/^חוות\s+/, '').trim()
  if (noFarmHe && noFarmHe !== labelHe) queries.push(noFarmHe)

  // 6. For "X and Y" / "X ו-Y" — try just the first part
  const firstPartEn = labelEn?.split(/\s+and\s+/i)[0].trim()
  if (firstPartEn && firstPartEn !== labelEn) queries.push(firstPartEn)

  const firstPartHe = labelHe?.split(/\s+ו[-]?\s*/)[0].trim()
  if (firstPartHe && firstPartHe !== labelHe) queries.push(firstPartHe)

  // 7. Strip "Junction" / "צומת"
  const noJunction = labelEn?.replace(/\s*junction\s*/i, '').trim()
  if (noJunction && noJunction !== labelEn) queries.push(noJunction)

  // Deduplicate
  return [...new Set(queries)].filter(Boolean)
}

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=il&format=json&limit=1`
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': NOMINATIM_UA } })
  const data = await res.json()
  await sleep(1100) // Nominatim rate limit: 1 req/s
  return data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
}

async function geocode(labelHe, labelEn) {
  const queries = buildQueries(labelHe, labelEn)
  for (const q of queries) {
    const coords = await nominatimSearch(q)
    if (coords) return coords
  }
  return null
}

async function main() {
  console.log('Fetching oref city list…')
  const [citiesHe, citiesEn] = await Promise.all([
    fetchOrefCities('he'),
    fetchOrefCities('en'),
  ])
  console.log(`  ${citiesHe.length} cities from oref`)

  // Build en label lookup: label_he → label_en
  const enByHe = new Map()
  for (const c of citiesEn) {
    const he = c.label_he || c.label
    const en = c.label
    if (he && en) enByHe.set(he, en)
  }

  // Load existing geo file
  const existing = JSON.parse(readFileSync(GEO_PATH, 'utf8'))
  const existingByHe = new Map(existing.map((e) => [e.label_he, e]))
  console.log(`Existing cities-geo.json: ${existing.length} entries`)

  // Find missing cities (deduplicated by label_he)
  const seen = new Set()
  const missing = []
  for (const c of citiesHe) {
    const labelHe = c.label_he || c.label
    if (!labelHe || seen.has(labelHe)) continue
    seen.add(labelHe)
    if (!existingByHe.has(labelHe)) {
      missing.push({ label_he: labelHe, label_en: enByHe.get(labelHe) || '' })
    }
  }
  console.log(`Missing from geo file: ${missing.length} cities\n`)

  if (missing.length === 0) {
    console.log('Nothing to do — cities-geo.json is already complete.')
    return
  }

  const newEntries = []
  const failed = []

  for (let i = 0; i < missing.length; i++) {
    const { label_he, label_en } = missing[i]
    process.stdout.write(`[${i + 1}/${missing.length}] ${label_he}… `)
    try {
      const coords = await geocode(label_he, label_en)
      if (coords) {
        console.log(`✓ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        newEntries.push({ label_he, label_en, lat: coords.lat, lng: coords.lng })
      } else {
        console.log('✗ not found')
        failed.push({ label_he, label_en })
      }
    } catch (err) {
      console.log(`✗ error: ${err.message}`)
      failed.push({ label_he, label_en })
    }
  }

  // Merge and sort by label_he
  const merged = [...existing, ...newEntries].sort((a, b) =>
    a.label_he.localeCompare(b.label_he, 'he'),
  )

  writeFileSync(GEO_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  console.log(`\n✅ cities-geo.json updated: ${merged.length} entries (+${newEntries.length} added)`)

  if (failed.length > 0) {
    console.log(`\n⚠️  Could not geocode ${failed.length} cities (add coordinates manually if needed):`)
    for (const { label_he, label_en } of failed) {
      console.log(`  - ${label_he} / ${label_en}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

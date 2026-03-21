/**
 * validate-cities-geo.mjs
 *
 * Removes entries from cities-geo.json whose coordinates don't match the
 * expected geographic region for their oref areaid.
 *
 * Usage:
 *   node scripts/validate-cities-geo.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GEO_PATH = resolve(__dirname, '../public/cities-geo.json')
const DRY_RUN = process.argv.includes('--dry-run')

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/', Origin: 'https://www.oref.org.il',
  'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/javascript, */*; q=0.01',
}

/**
 * Per-areaid bounding boxes [minLat, minLng, maxLat, maxLng].
 * Only areaids with well-defined, non-overlapping boundaries are listed.
 * Unlisted areaids pass through without validation.
 */
const AREA_BBOX = {
  1:  [29.4, 34.7, 30.1, 35.1],  // Eilat
  3:  [31.6, 35.1, 32.6, 35.9],  // Jordan Valley (must be east of ridge)
  8:  [31.9, 34.7, 32.3, 35.0],  // Dan / Tel Aviv metro
  10: [31.7, 34.9, 32.6, 35.6],  // Samaria / West Bank North
  17: [31.1, 34.85, 32.0, 35.6], // Judea / West Bank South
  18: [30.6, 35.1, 31.9, 35.7],  // Dead Sea
  20: [31.6, 35.0, 32.0, 35.5],  // Jerusalem
  22: [31.3, 34.4, 32.0, 35.1],  // Shfela South / Lachish
  26: [31.1, 34.2, 31.7, 34.8],  // Gaza Envelope
  29: [29.4, 34.6, 30.9, 35.3],  // Arava
}

function inBbox(lat, lng, bbox) {
  return lat >= bbox[0] && lat <= bbox[2] && lng >= bbox[1] && lng <= bbox[3]
}

function isValid(entry, areaid) {
  const { lat, lng } = entry
  if (lat > 33.5 || lat < 29.0) return false // Lebanon/Syria or Sinai
  const bbox = AREA_BBOX[areaid]
  if (bbox && !inBbox(lat, lng, bbox)) return false
  return true
}

async function main() {
  const res = await fetch(
    'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=he',
    { headers: OREF_HEADERS }
  )
  const cities = JSON.parse(await res.text())
  const areaByName = new Map(cities.map((c) => [c.label_he || c.label, c.areaid]))

  const geo = JSON.parse(readFileSync(GEO_PATH, 'utf8'))
  console.log(`Loaded ${geo.length} entries\n`)

  const removed = []
  const kept = []

  for (const entry of geo) {
    const areaid = areaByName.get(entry.label_he)
    if (areaid != null && !isValid(entry, areaid)) {
      removed.push({ ...entry, areaid })
    } else {
      kept.push(entry)
    }
  }

  console.log(`Valid: ${kept.length} | Removed: ${removed.length}\n`)
  if (removed.length > 0) {
    for (const e of removed.sort((a, b) => a.areaid - b.areaid)) {
      console.log(`  [area ${e.areaid}] ${e.label_he} — ${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`)
    }
  }

  if (!DRY_RUN && removed.length > 0) {
    writeFileSync(GEO_PATH, JSON.stringify(kept, null, 2) + '\n', 'utf8')
    console.log(`\n✅ Updated: ${kept.length} entries (-${removed.length})`)
  } else if (DRY_RUN) {
    console.log('\n(dry-run)')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

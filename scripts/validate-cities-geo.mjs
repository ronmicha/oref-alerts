/**
 * validate-cities-geo.mjs
 *
 * Validates cities-geo.json by removing entries whose coordinates don't match
 * their expected geographic region (oref areaid).
 *
 * Rules:
 *   areaid=3  (Jordan Valley)  → must have lng > 35.1
 *   areaid=10 (Samaria)        → must have lng > 34.9
 *   areaid=17 (Judea)          → must have lng > 34.85
 *   All areas                  → must have lat < 33.5 (not in Lebanon/Syria)
 *   All areas                  → must have lat > 29.0 (not in Sinai)
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

function isValid(entry, areaid) {
  const { lat, lng } = entry
  // Extreme outliers (Lebanon/Syria, Sinai)
  if (lat > 33.5 || lat < 29.0) return false
  // Jordan Valley settlements must be east of the Judean ridge
  if (areaid === 3  && lng < 35.1) return false
  // Samaria settlements must be east of the Green Line
  if (areaid === 10 && lng < 34.9) return false
  // Judea settlements must be east of the Green Line
  if (areaid === 17 && lng < 34.85) return false
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
  console.log(`Loaded ${geo.length} cities from cities-geo.json\n`)

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

  console.log(`Valid:   ${kept.length}`)
  console.log(`Removed: ${removed.length}\n`)

  if (removed.length > 0) {
    console.log('Removed entries:')
    for (const e of removed.sort((a, b) => a.areaid - b.areaid || a.label_he.localeCompare(b.label_he, 'he'))) {
      console.log(`  [area ${e.areaid}] ${e.label_he} — was at ${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`)
    }
  }

  if (!DRY_RUN && removed.length > 0) {
    writeFileSync(GEO_PATH, JSON.stringify(kept, null, 2) + '\n', 'utf8')
    console.log(`\n✅ cities-geo.json updated: ${kept.length} entries (-${removed.length} removed)`)
  } else if (DRY_RUN) {
    console.log('\n(dry-run — no changes written)')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

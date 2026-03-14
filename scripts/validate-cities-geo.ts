/**
 * Validation script — run once after generating cities-geo.json.
 * Reports city names that appear in Oref or TzevaAdom data but are missing from the geo file.
 *
 * Usage:
 *   npx tsx scripts/validate-cities-geo.ts
 */

import { getCityCoords } from '../lib/citiesGeo'

const CITIES_URL_HE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=HE'
const TZEVAADOM_URL = 'https://www.tzevaadom.co.il/static/notifications.json'

interface OrefCity { label: string; id: string }
type TzevaadomEntry = [number, number, string[], number]

async function main() {
  console.log('Fetching Oref city list...')
  const orefRes = await fetch(CITIES_URL_HE, {
    headers: { Referer: 'https://www.oref.org.il/', 'User-Agent': 'oref-alerts-validator/1.0' },
  })
  if (!orefRes.ok) throw new Error(`Oref cities fetch failed: ${orefRes.status}`)
  const orefCities: OrefCity[] = await orefRes.json()
  console.log(`Oref: ${orefCities.length} cities`)

  console.log('Fetching TzevaAdom data...')
  const tzCitySet = new Set<string>()
  const tzRes = await fetch(TZEVAADOM_URL, { headers: { 'User-Agent': 'oref-alerts-validator/1.0' } })
  if (!tzRes.ok) {
    console.warn(`TzevaAdom fetch failed (${tzRes.status}) — skipping TzevaAdom validation.`)
  } else {
    const tzRaw: TzevaadomEntry[] = await tzRes.json()
    for (const [, , cities] of tzRaw) {
      for (const c of cities) tzCitySet.add(c)
    }
    console.log(`TzevaAdom: ${tzCitySet.size} unique city names`)
  }

  const missingOref: string[] = []
  for (const city of orefCities) {
    if (!getCityCoords(city.label)) missingOref.push(city.label)
  }

  const missingTz: string[] = []
  for (const name of tzCitySet) {
    if (!getCityCoords(name)) missingTz.push(name)
  }

  if (missingOref.length === 0) {
    console.log('\nAll Oref cities found in geo file.')
  } else {
    console.warn(`\nMissing from geo file (Oref) — ${missingOref.length} cities:`)
    missingOref.forEach((c) => console.warn('  -', c))
  }

  if (missingTz.length === 0) {
    console.log('\nAll TzevaAdom cities found in geo file.')
  } else {
    console.warn(`\nMissing from geo file (TzevaAdom) — ${missingTz.length} cities:`)
    missingTz.forEach((c) => console.warn('  -', c))
  }

  const totalMissing = new Set([...missingOref, ...missingTz]).size
  console.log(`\nSummary: ${totalMissing} city names without coordinates.`)
  console.log('These cities will not appear on the map — this is acceptable for small localities.')
}

main().catch((e) => { console.error(e); process.exit(1) })

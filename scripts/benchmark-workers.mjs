/**
 * Benchmark: find the optimal number of concurrent workers for city alert fetching.
 *
 * Calls the oref API directly (same URLs/headers the Next.js proxy uses).
 * Tests WORKER_COUNTS in order, reports ms per run, and prints the winner.
 *
 * Usage:  node scripts/benchmark-workers.mjs
 */

const CITIES_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=he'
const HISTORY_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

const OREF_HEADERS = {
  Referer: 'https://www.oref.org.il/',
  Origin: 'https://www.oref.org.il',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}

// Concurrency levels to test (in order)
const WORKER_COUNTS = [40, 50, 60, 70, 80, 100, 120, 150, 200]
const RUNS_PER_LEVEL = 3   // average over this many runs for stable results

async function orefGet(url) {
  const res = await fetch(url, { headers: OREF_HEADERS, cache: 'no-store' })
  const text = await res.text()
  return text.trim() ? JSON.parse(text) : []
}

async function fetchCityLabels() {
  const cities = await orefGet(CITIES_URL)
  return [...new Set(
    cities
      .filter(c => !c.label.includes('כל האזורים') && !c.label.includes('כל - האזורים'))
      .map(c => c.label)
  )].sort()
}

async function fetchCityCount(cityLabel) {
  const url = new URL(HISTORY_BASE)
  url.searchParams.set('lang', 'he')
  url.searchParams.set('mode', '2')
  url.searchParams.set('city_0', cityLabel)
  const alerts = await orefGet(url.toString())
  return alerts.length
}

async function runWithWorkers(cityLabels, numWorkers) {
  let index = 0
  let completed = 0

  async function worker() {
    while (true) {
      const i = index++
      if (i >= cityLabels.length) break
      try {
        await fetchCityCount(cityLabels[i])
        completed++
      } catch {
        completed++
      }
    }
  }

  const start = performance.now()
  const workers = Array.from({ length: Math.min(numWorkers, cityLabels.length) }, () => worker())
  await Promise.all(workers)
  const elapsed = performance.now() - start

  return { elapsed, completed }
}

// ─── main ───────────────────────────────────────────────────────────────────

console.log('Fetching city list…')
const allCityLabels = await fetchCityLabels()
console.log(`${allCityLabels.length} cities found.\n`)

// Use a fixed sample for speed — large enough to show concurrency effects
const SAMPLE_SIZE = 200
const sample = allCityLabels.slice(0, SAMPLE_SIZE)
console.log(`Benchmarking with first ${SAMPLE_SIZE} cities.\n`)
console.log('Workers │ Avg (s)  │ ms/city  (individual runs)')
console.log('────────┼──────────┼────────')

const results = []

for (const workers of WORKER_COUNTS) {
  const times = []
  for (let r = 0; r < RUNS_PER_LEVEL; r++) {
    const { elapsed } = await runWithWorkers(sample, workers)
    times.push(elapsed)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const seconds = (avg / 1000).toFixed(2)
  const msPerCity = (avg / SAMPLE_SIZE).toFixed(1)
  const allTimes = times.map(t => (t / 1000).toFixed(2)).join(' / ')
  console.log(`${String(workers).padStart(7)} │ ${seconds.padStart(8)} │ ${msPerCity.padStart(7)}  (${allTimes})`)
  results.push({ workers, elapsed: avg })
}

const best = results.reduce((a, b) => a.elapsed < b.elapsed ? a : b)

console.log('\n──────────────────────────────────')
console.log(`Optimal: ${best.workers} workers (${(best.elapsed / 1000).toFixed(2)}s for ${SAMPLE_SIZE} cities)`)
console.log('──────────────────────────────────')

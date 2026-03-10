/**
 * AWS Lambda — oref API proxy (il-central-1, Israel region)
 *
 * Functionally identical to workers/oref-proxy.js but runs as an AWS Lambda
 * Function URL in the il-central-1 region, which has genuine Israeli IP
 * addresses — no placement algorithm, no traffic warmup required.
 *
 * Endpoints (mirror the Next.js /api routes and the CF Worker):
 *   GET /history?mode=2&lang=he[&city=<city>]
 *   GET /cities?lang=he
 *   GET /categories
 *
 * Deploy: see deploy.sh in this directory.
 */

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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function respond(body, statusCode = 200, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

async function orefFetch(url) {
  const res = await fetch(url, { headers: OREF_HEADERS })
  const text = await res.text()
  if (!text.trim()) return '[]'
  if (text.trimStart().startsWith('<')) {
    throw new Error(`oref returned HTML (status ${res.status}) — blocked`)
  }
  return text
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? 'GET'

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  const path = event.rawPath ?? '/'
  const qs = event.queryStringParameters ?? {}

  try {
    if (path === '/history') {
      const mode = qs.mode ?? '3'
      const lang = qs.lang === 'en' ? 'en' : 'he'
      const city = qs.city
      const fromDate = qs.fromDate
      const toDate = qs.toDate

      const url = new URL('https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx')
      url.searchParams.set('lang', lang)
      url.searchParams.set('mode', mode)
      if (city) url.searchParams.set('city_0', city)
      if (fromDate) url.searchParams.set('fromDate', fromDate)
      if (toDate) url.searchParams.set('toDate', toDate)

      const data = await orefFetch(url.toString())
      return respond(data, 200, { 'Cache-Control': 'no-store' })
    }

    if (path === '/cities') {
      const lang = qs.lang === 'en' ? 'en' : 'he'
      const data = await orefFetch(
        `https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=${lang}`
      )
      return respond(data, 200, { 'Cache-Control': 'max-age=3600' })
    }

    if (path === '/categories') {
      const data = await orefFetch('https://www.oref.org.il/alerts/alertCategories.json')
      return respond(data, 200, { 'Cache-Control': 'max-age=3600' })
    }

    return respond({ error: 'Not found' }, 404)
  } catch (err) {
    return respond({ error: String(err) }, 502)
  }
}

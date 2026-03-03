/**
 * Cloudflare Worker — oref API proxy
 *
 * Proxies requests to oref's API endpoints and adds CORS headers so the
 * browser can read the responses. Runs inside Cloudflare's network, which
 * bypasses the bot-detection that blocks external datacenter IPs (Vercel etc.)
 *
 * Endpoints (mirror the Next.js /api routes):
 *   GET /history?mode=2&lang=he[&city=<city>]
 *   GET /cities?lang=he
 *   GET /categories
 *
 * Deploy:
 *   1. cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this file, click Deploy
 *   3. Copy the *.workers.dev URL
 *   4. Set NEXT_PUBLIC_OREF_PROXY=<that URL> in Vercel → Settings → Environment Variables
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

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })
}

async function orefFetch(url) {
  const res = await fetch(url, { headers: OREF_HEADERS })
  const text = await res.text()
  if (!text.trim()) return '[]'
  if (text.trimStart().startsWith('<')) {
    throw new Error(`oref returned HTML (status ${res.status}) — still blocked`)
  }
  return text
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const { pathname, searchParams } = new URL(request.url)

    try {
      if (pathname === '/history') {
        const mode = searchParams.get('mode') ?? '3'
        const lang = searchParams.get('lang') === 'en' ? 'en' : 'he'
        const city = searchParams.get('city')

        const url = new URL('https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx')
        url.searchParams.set('lang', lang)
        url.searchParams.set('mode', mode)
        if (city) url.searchParams.set('city_0', city)

        const data = await orefFetch(url.toString())
        return new Response(data, {
          headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'no-store' },
        })
      }

      if (pathname === '/cities') {
        const lang = searchParams.get('lang') === 'en' ? 'en' : 'he'
        const data = await orefFetch(
          `https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=${lang}`
        )
        return new Response(data, {
          headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'max-age=3600' },
        })
      }

      if (pathname === '/categories') {
        const data = await orefFetch('https://www.oref.org.il/alerts/alertCategories.json')
        return new Response(data, {
          headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'max-age=3600' },
        })
      }

      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: String(err) }, 502)
    }
  },
}

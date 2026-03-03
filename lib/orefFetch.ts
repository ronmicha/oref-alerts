/**
 * Headers that mimic a real browser AJAX request to oref.org.il.
 * Required to avoid the server returning an HTML block page instead of JSON.
 */
export const OREF_HEADERS = {
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

/**
 * Fetch from oref, parse JSON safely.
 * Returns the parsed data, or throws with a descriptive message.
 */
export async function orefFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { ...OREF_HEADERS, ...init?.headers } })

  const text = await res.text()

  if (!text.trim()) return []

  try {
    return JSON.parse(text)
  } catch {
    // Server returned non-JSON (HTML block page, error page, etc.)
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ')
    throw new Error(`Upstream returned non-JSON (status ${res.status}): ${snippet}`)
  }
}

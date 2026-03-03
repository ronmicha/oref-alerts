import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

const CITIES_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx'

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'he'
  const url = `${CITIES_BASE}?lang=${lang}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Referer: 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'upstream fetch failed', detail: String(err) }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 })
  }

  const text = await res.text()
  const data = text.trim() ? JSON.parse(text) : []
  return NextResponse.json(data)
}

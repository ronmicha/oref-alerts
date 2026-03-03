import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

const BASE_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode') ?? '3'
  const city = searchParams.get('city')

  const lang = searchParams.get('lang') === 'en' ? 'en' : 'he'

  const url = new URL(BASE_URL)
  url.searchParams.set('lang', lang)
  url.searchParams.set('mode', mode)
  if (city) url.searchParams.set('city_0', city)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: {
        Referer: 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
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

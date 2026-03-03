import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

const CITIES_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx'

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang') ?? 'he'
  const url = `${CITIES_BASE}?lang=${lang}`
  const res = await fetch(url, {
    headers: { Referer: 'https://www.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest' },
  })
  const data = await res.json()
  return NextResponse.json(data)
}

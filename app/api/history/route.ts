import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

const BASE_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode') ?? '3'
  const city = searchParams.get('city')

  const url = new URL(BASE_URL)
  url.searchParams.set('lang', 'he')
  url.searchParams.set('mode', mode)
  if (city) url.searchParams.set('city_0', city)

  const res = await fetch(url.toString(), {
    headers: {
      Referer: 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
    },
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data)
}

import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'
import { orefFetch } from '@/lib/orefFetch'

export const runtime = 'edge'

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

  try {
    const data = await orefFetch(url.toString(), { cache: 'no-store' })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

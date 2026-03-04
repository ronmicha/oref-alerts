import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'
import { orefFetch } from '@/lib/orefFetch'

export const runtime = 'edge'


const CITIES_BASE = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx'

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'he'
  const url = `${CITIES_BASE}?lang=${lang}`

  try {
    const data = await orefFetch(url)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

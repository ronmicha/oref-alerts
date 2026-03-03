import { NextResponse } from 'next/server'

const CITIES_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=he'

export async function GET() {
  const res = await fetch(CITIES_URL, {
    headers: { Referer: 'https://www.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest' },
  })
  const data = await res.json()
  return NextResponse.json(data)
}

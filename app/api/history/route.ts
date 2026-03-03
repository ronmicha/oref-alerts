import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(
    'https://alerts-history.oref.org.il//Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=3',
    {
      headers: {
        Referer: 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    }
  )
  const data = await res.json()
  return NextResponse.json(data)
}

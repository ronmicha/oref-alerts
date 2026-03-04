import { NextResponse } from 'next/server'
export const runtime = 'edge'

export async function GET() {
  const res = await fetch('https://www.tzevaadom.co.il/static/historical/all.json')
  if (!res.ok) return NextResponse.json({ error: 'upstream failed' }, { status: 502 })
  const data = await res.json()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  })
}

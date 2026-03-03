import { NextResponse } from 'next/server'

const ALLOWED_CATEGORIES = new Set(['missilealert', 'uav'])

export async function GET() {
  const res = await fetch('https://www.oref.org.il/alerts/alertCategories.json')
  const data = await res.json()
  return NextResponse.json(data.filter((c: { category: string }) => ALLOWED_CATEGORIES.has(c.category)))
}

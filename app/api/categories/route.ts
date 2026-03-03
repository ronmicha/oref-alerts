import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch('https://www.oref.org.il/alerts/alertCategories.json')
  const data = await res.json()
  return NextResponse.json(data)
}

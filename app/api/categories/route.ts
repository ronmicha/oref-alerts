import { NextResponse } from 'next/server'

export async function GET() {
  let res: Response
  try {
    res = await fetch('https://www.oref.org.il/alerts/alertCategories.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
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

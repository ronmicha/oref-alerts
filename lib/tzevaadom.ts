import type { AlarmHistoryItem } from '@/types/oref'

export type TzevaadomEntry = [number, number, string[], number]

const TZEVAADOM_CATEGORY_MAP: Record<number, { category: number; category_desc: string; matrix_id: number }> = {
  0: { category: 1, category_desc: 'ירי רקטות וטילים', matrix_id: 1 },
  5: { category: 2, category_desc: 'חדירת כלי טיס עוין', matrix_id: 6 },
}

export const TZEVAADOM_ALLOWED_CODES = new Set(Object.keys(TZEVAADOM_CATEGORY_MAP).map(Number))

function toIsraelDateTime(ts: number): { alertDate: string; date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ts * 1000)).map(({ type, value }) => [type, value]))
  const alertDate = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  const date = `${parts.day}/${parts.month}/${parts.year}`
  const time = `${parts.hour}:${parts.minute}:${parts.second}`
  return { alertDate, date, time }
}

export async function fetchTzevaadomRaw(): Promise<TzevaadomEntry[]> {
  const res = await fetch('/api/tzevaadom')
  if (!res.ok) throw new Error(`Failed to fetch tzevaadom data: ${res.status}`)
  return res.json()
}

export async function fetchTzevaadomHistory(): Promise<AlarmHistoryItem[]> {
  const entries = await fetchTzevaadomRaw()

  const expanded: AlarmHistoryItem[] = []
  for (const [rid, categoryCode, cities, ts] of entries) {
    const catInfo = TZEVAADOM_CATEGORY_MAP[categoryCode]
    if (!catInfo) continue
    const { alertDate, date, time } = toIsraelDateTime(ts)
    for (const city of cities) {
      expanded.push({
        data: city,
        date,
        time,
        alertDate,
        category: catInfo.category,
        category_desc: catInfo.category_desc,
        matrix_id: catInfo.matrix_id,
        rid,
      })
    }
  }

  return expanded
}

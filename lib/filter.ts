import type { AlarmHistoryItem, DayCount, TimeSlotCount } from '@/types/oref'

interface FilterOptions {
  cityLabel?: string  // exact city name — matches alert.data
  categoryId?: number
  startDate?: string  // "YYYY-MM-DD"
  endDate?: string    // "YYYY-MM-DD"
}

export function filterAlerts(
  alerts: AlarmHistoryItem[],
  options: FilterOptions
): AlarmHistoryItem[] {
  return alerts.filter((alert) => {
    if (options.cityLabel) {
      if (alert.data !== options.cityLabel) return false
    }
    if (options.categoryId !== undefined) {
      if (alert.category !== options.categoryId) return false
    }
    if (options.startDate) {
      if (alert.alertDate.slice(0, 10) < options.startDate) return false
    }
    if (options.endDate) {
      if (alert.alertDate.slice(0, 10) > options.endDate) return false
    }
    return true
  })
}

const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HE_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]

function dateToKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function aggregateByDay(
  alerts: AlarmHistoryItem[],
  { startDate, endDate, lang }: { startDate: string; endDate: string; lang: 'he' | 'en' }
): DayCount[] {
  const countMap = new Map<string, number>()
  const byCategoryMap = new Map<string, Record<number, number>>()
  const timeRangeMap = new Map<string, { start: string; end: string }>()
  for (const alert of alerts) {
    const key = alert.alertDate.slice(0, 10)
    const time = alert.alertDate.slice(11, 16) // "HH:MM"
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
    if (!byCategoryMap.has(key)) byCategoryMap.set(key, {})
    const cats = byCategoryMap.get(key)!
    cats[alert.category] = (cats[alert.category] ?? 0) + 1
    const tr = timeRangeMap.get(key)
    if (!tr) timeRangeMap.set(key, { start: time, end: time })
    else {
      if (time < tr.start) tr.start = time
      if (time > tr.end) tr.end = time
    }
  }

  const days: DayCount[] = []
  const cursor = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const days_arr = lang === 'he' ? HE_DAYS : EN_DAYS

  while (cursor <= end) {
    const key = dateToKey(cursor)
    const day = cursor.getDay()
    const dd = String(cursor.getDate()).padStart(2, '0')
    const mm = String(cursor.getMonth() + 1).padStart(2, '0')
    const tr = timeRangeMap.get(key)
    days.push({
      dateKey: key,
      label: `${dd}/${mm}`,
      dayName: days_arr[day],
      count: countMap.get(key) ?? 0,
      byCategory: byCategoryMap.get(key) ?? {},
      startTime: tr?.start,
      endTime: tr?.end,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

export function aggregateByTimeOfDay(alerts: AlarmHistoryItem[]): TimeSlotCount[] {
  const countMap = new Map<string, number>()
  const byCategoryMap = new Map<string, Record<number, number>>()

  for (const alert of alerts) {
    // alertDate format: "YYYY-MM-DDTHH:MM:SS"
    const h = Number(alert.alertDate.slice(11, 13))
    const m = Number(alert.alertDate.slice(14, 16))
    const bucket = Math.floor(m / 15) * 15
    const key = `${String(h).padStart(2, '0')}:${String(bucket).padStart(2, '0')}`

    countMap.set(key, (countMap.get(key) ?? 0) + 1)
    if (!byCategoryMap.has(key)) byCategoryMap.set(key, {})
    const cats = byCategoryMap.get(key)!
    cats[alert.category] = (cats[alert.category] ?? 0) + 1
  }

  // All 96 slots: 00:00, 00:15, ..., 23:45
  const slots: TimeSlotCount[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const key = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      slots.push({ timeKey: key, count: countMap.get(key) ?? 0, byCategory: byCategoryMap.get(key) ?? {} })
    }
  }
  return slots
}

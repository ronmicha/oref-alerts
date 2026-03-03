import type { AlarmHistoryItem, DayCount } from '@/types/oref'

interface FilterOptions {
  cityLabel?: string  // full city label: "CityName | AreaName"
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
      const cityName = options.cityLabel.split(' | ')[0]
      if (alert.data !== cityName) return false
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
  startDate: string,
  endDate: string,
  lang: 'he' | 'en'
): DayCount[] {
  const countMap = new Map<string, number>()
  for (const alert of alerts) {
    const key = alert.alertDate.slice(0, 10)
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
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
    days.push({
      dateKey: key,
      label: `${dd}/${mm}`,
      dayName: days_arr[day],
      count: countMap.get(key) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

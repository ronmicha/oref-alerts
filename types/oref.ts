export interface City {
  areaid: number
  cityAlId: string
  id: string
  label: string    // format: "CityName | AreaName"
  rashut: string | null
  color: string
}

export interface AlertCategory {
  id: number
  category: string
  matrix_id: number
  priority: number
  queue: boolean
}

export interface AlarmHistoryItem {
  data: string
  date: string
  time: string
  alertDate: string
  category: number
  category_desc: string
  matrix_id: number
  rid: number
}

export interface DayCount {
  dateKey: string   // "YYYY-MM-DD" — used for internal grouping
  label: string     // "DD/MM" — displayed on x-axis
  dayName: string   // "Mon" or "ב'" depending on language
  count: number
}

export type DateRangeOption = 'today' | '7d' | '14d' | '30d'

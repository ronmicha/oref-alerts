export interface City {
  label: string      // city name — matches alert.data exactly
  value: string      // UUID
  id: string
  areaid: number
  color: string
  migun_time: number
  rashut: string
  label_he: string
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
  byCategory: Record<number, number>  // categoryId → count
}

export interface TimeSlotCount {
  timeKey: string              // "HH:MM" — start of the 15-min window
  count: number
  byCategory: Record<number, number>
}

export type DateRangeOption = 'today' | '7d' | '14d' | '30d'

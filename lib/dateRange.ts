import type { DateRangeOption } from '@/types/oref'

export function getPresetDateRange(option: Exclude<DateRangeOption, 'custom'>): { startDate: string; endDate: string } {
  const today = new Date()
  const end = today.toISOString().slice(0, 10)
  const start = new Date(today)
  if (option === '24h') start.setDate(start.getDate() - 1)
  else if (option === '7d') start.setDate(start.getDate() - 6)
  else if (option === '30d') start.setDate(start.getDate() - 29)
  return { startDate: start.toISOString().slice(0, 10), endDate: end }
}

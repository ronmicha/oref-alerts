import type { DateRangeOption } from '@/types/oref'

// Format a Date as 'YYYY-MM-DDTHH:mm' using the system's local timezone.
// Alert timestamps from the oref API are in local Israel time, so we must
// compare against local time — not UTC (which toISOString() would give).
function toLocalStr(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function getPresetDateRange(option: Exclude<DateRangeOption, 'custom'>): { startDate: string; endDate: string } {
  const now = new Date()
  const end = toLocalStr(now)
  const start = new Date(now)
  if (option === '24h') start.setDate(start.getDate() - 1)
  else if (option === '7d') start.setDate(start.getDate() - 7)
  else if (option === '30d') start.setDate(start.getDate() - 30)
  return { startDate: toLocalStr(start), endDate: end }
}

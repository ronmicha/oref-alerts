import { getPresetDateRange } from '../dateRange'

// Fixed "now": 2026-03-11T10:00:00Z (well past midnight UTC, unambiguous date)
const FIXED_NOW = new Date('2026-03-11T10:00:00Z')

// Mirror the production toLocalStr logic so expected values are timezone-portable
function toLocalStr(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function daysAgo(n: number): string {
  const d = new Date(FIXED_NOW)
  d.setDate(d.getDate() - n)
  return toLocalStr(d)
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

describe('getPresetDateRange', () => {
  it('"24h" returns a rolling 24-hour window ending now', () => {
    const result = getPresetDateRange('24h')
    expect(result).toEqual({ startDate: daysAgo(1), endDate: toLocalStr(FIXED_NOW) })
  })

  it('"7d" returns a rolling 7-day window ending now', () => {
    const result = getPresetDateRange('7d')
    expect(result).toEqual({ startDate: daysAgo(7), endDate: toLocalStr(FIXED_NOW) })
  })

  it('"30d" returns a rolling 30-day window ending now', () => {
    const result = getPresetDateRange('30d')
    expect(result).toEqual({ startDate: daysAgo(30), endDate: toLocalStr(FIXED_NOW) })
  })
})

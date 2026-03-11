import { getPresetDateRange } from '../dateRange'

// Fixed "now": 2026-03-11T10:00:00Z (well past midnight UTC, unambiguous date)
const FIXED_NOW = new Date('2026-03-11T10:00:00Z')

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
    expect(result).toEqual({ startDate: '2026-03-10T10:00', endDate: '2026-03-11T10:00' })
  })

  it('"7d" returns a rolling 7-day window ending now', () => {
    const result = getPresetDateRange('7d')
    expect(result).toEqual({ startDate: '2026-03-04T10:00', endDate: '2026-03-11T10:00' })
  })

  it('"30d" returns a rolling 30-day window ending now', () => {
    const result = getPresetDateRange('30d')
    expect(result).toEqual({ startDate: '2026-02-09T10:00', endDate: '2026-03-11T10:00' })
  })
})

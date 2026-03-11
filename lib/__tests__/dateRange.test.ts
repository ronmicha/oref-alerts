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
  it('"24h" returns the last 24 hours (startDate = yesterday, endDate = today)', () => {
    const result = getPresetDateRange('24h')
    // At 2026-03-11T10:00Z, "last 24 hours" should cover 2026-03-10 through 2026-03-11
    expect(result).toEqual({ startDate: '2026-03-10', endDate: '2026-03-11' })
  })

  it('"7d" returns a 7-day window ending today', () => {
    const result = getPresetDateRange('7d')
    expect(result).toEqual({ startDate: '2026-03-05', endDate: '2026-03-11' })
  })

  it('"30d" returns a 30-day window ending today', () => {
    const result = getPresetDateRange('30d')
    expect(result).toEqual({ startDate: '2026-02-10', endDate: '2026-03-11' })
  })
})

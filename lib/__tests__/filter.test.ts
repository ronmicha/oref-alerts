import { filterAlerts, aggregateByDay } from '../filter'
import type { AlarmHistoryItem } from '@/types/oref'

const makeAlert = (overrides: Partial<AlarmHistoryItem> = {}): AlarmHistoryItem => ({
  data: 'תל אביב',
  date: '01.03.2026',
  time: '10:00:00',
  alertDate: '2026-03-01T10:00:00',
  category: 1,
  category_desc: 'ירי רקטות וטילים',
  matrix_id: 1,
  rid: 1,
  ...overrides,
})

describe('filterAlerts', () => {
  it('returns all alerts when no filters are set', () => {
    const alerts = [makeAlert(), makeAlert({ data: 'רמת גן' })]
    const result = filterAlerts(alerts, {})
    expect(result).toHaveLength(2)
  })

  it('filters by city label (exact match on alert.data)', () => {
    const alerts = [
      makeAlert({ data: 'תל אביב - מרכז העיר' }),
      makeAlert({ data: 'ירושלים' }),
    ]
    const result = filterAlerts(alerts, { cityLabel: 'תל אביב - מרכז העיר' })
    expect(result).toHaveLength(1)
    expect(result[0].data).toBe('תל אביב - מרכז העיר')
  })

  it('filters by city label for single-name cities', () => {
    const alerts = [
      makeAlert({ data: 'ירושלים' }),
      makeAlert({ data: 'אשדוד' }),
    ]
    const result = filterAlerts(alerts, { cityLabel: 'ירושלים' })
    expect(result).toHaveLength(1)
    expect(result[0].data).toBe('ירושלים')
  })

  it('filters by category', () => {
    const alerts = [
      makeAlert({ category: 1 }),
      makeAlert({ category: 2 }),
    ]
    const result = filterAlerts(alerts, { categoryId: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe(2)
  })

  it('filters by date range (startDate inclusive)', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-05T10:00:00' }),
    ]
    const result = filterAlerts(alerts, { startDate: '2026-03-03' })
    expect(result).toHaveLength(1)
    expect(result[0].alertDate).toContain('2026-03-05')
  })

  it('filters by date range (endDate inclusive)', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-05T10:00:00' }),
    ]
    const result = filterAlerts(alerts, { endDate: '2026-03-03' })
    expect(result).toHaveLength(1)
    expect(result[0].alertDate).toContain('2026-03-01')
  })

  it('applies multiple filters together', () => {
    const alerts = [
      makeAlert({ data: 'תל אביב', category: 1, alertDate: '2026-03-02T10:00:00' }),
      makeAlert({ data: 'ירושלים', category: 1, alertDate: '2026-03-02T10:00:00' }),
      makeAlert({ data: 'תל אביב', category: 2, alertDate: '2026-03-02T10:00:00' }),
    ]
    const result = filterAlerts(alerts, { cityLabel: 'תל אביב', categoryId: 1 })
    expect(result).toHaveLength(1)
  })
})

describe('aggregateByDay', () => {
  it('returns one entry per day', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-01T14:00:00' }),
      makeAlert({ alertDate: '2026-03-02T10:00:00' }),
    ]
    const result = aggregateByDay(alerts, '2026-03-01', '2026-03-02', 'en')
    expect(result).toHaveLength(2)
    expect(result[0].count).toBe(2)
    expect(result[1].count).toBe(1)
  })

  it('fills in days with zero alerts', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-03T10:00:00' }),
    ]
    const result = aggregateByDay(alerts, '2026-03-01', '2026-03-03', 'en')
    expect(result).toHaveLength(3)
    expect(result[1].count).toBe(0)
    expect(result[1].dateKey).toBe('2026-03-02')
  })

  it('sets label as DD/MM', () => {
    const alerts = [makeAlert({ alertDate: '2026-03-07T10:00:00' })]
    const result = aggregateByDay(alerts, '2026-03-07', '2026-03-07', 'en')
    expect(result[0].label).toBe('07/03')
  })

  it('sets English day names', () => {
    const alerts = [makeAlert({ alertDate: '2026-03-02T10:00:00' })] // Monday
    const result = aggregateByDay(alerts, '2026-03-02', '2026-03-02', 'en')
    expect(result[0].dayName).toBe('Mon')
  })

  it('sets Hebrew day names', () => {
    const alerts = [makeAlert({ alertDate: '2026-03-02T10:00:00' })] // Monday
    const result = aggregateByDay(alerts, '2026-03-02', '2026-03-02', 'he')
    expect(result[0].dayName).toBe("ב'")
  })
})

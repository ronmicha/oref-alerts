import { filterAlerts, aggregateByDay } from '../filter'
import type { AlarmHistoryItem, District } from '@/types/oref'

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

const districts: District[] = [
  { areaid: 1, areaname: 'גוש דן', id: '1', label: 'תל אביב', label_he: 'תל אביב', rashut: null, migun_time: 90 },
  { areaid: 1, areaname: 'גוש דן', id: '2', label: 'רמת גן', label_he: 'רמת גן', rashut: null, migun_time: 90 },
  { areaid: 2, areaname: 'ירושלים', id: '3', label: 'ירושלים', label_he: 'ירושלים', rashut: null, migun_time: 90 },
]

describe('filterAlerts', () => {
  it('returns all alerts when no filters are set', () => {
    const alerts = [makeAlert(), makeAlert({ data: 'רמת גן' })]
    const result = filterAlerts(alerts, districts, {})
    expect(result).toHaveLength(2)
  })

  it('filters by area name', () => {
    const alerts = [
      makeAlert({ data: 'תל אביב' }),
      makeAlert({ data: 'ירושלים' }),
    ]
    const result = filterAlerts(alerts, districts, { areaname: 'גוש דן' })
    expect(result).toHaveLength(1)
    expect(result[0].data).toBe('תל אביב')
  })

  it('filters by category', () => {
    const alerts = [
      makeAlert({ category: 1 }),
      makeAlert({ category: 2 }),
    ]
    const result = filterAlerts(alerts, districts, { categoryId: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe(2)
  })

  it('filters by date range (startDate inclusive)', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-05T10:00:00' }),
    ]
    const result = filterAlerts(alerts, districts, { startDate: '2026-03-03' })
    expect(result).toHaveLength(1)
    expect(result[0].alertDate).toContain('2026-03-05')
  })

  it('filters by date range (endDate inclusive)', () => {
    const alerts = [
      makeAlert({ alertDate: '2026-03-01T10:00:00' }),
      makeAlert({ alertDate: '2026-03-05T10:00:00' }),
    ]
    const result = filterAlerts(alerts, districts, { endDate: '2026-03-03' })
    expect(result).toHaveLength(1)
    expect(result[0].alertDate).toContain('2026-03-01')
  })

  it('applies multiple filters together', () => {
    const alerts = [
      makeAlert({ data: 'תל אביב', category: 1, alertDate: '2026-03-02T10:00:00' }),
      makeAlert({ data: 'ירושלים', category: 1, alertDate: '2026-03-02T10:00:00' }),
      makeAlert({ data: 'תל אביב', category: 2, alertDate: '2026-03-02T10:00:00' }),
    ]
    const result = filterAlerts(alerts, districts, { areaname: 'גוש דן', categoryId: 1 })
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

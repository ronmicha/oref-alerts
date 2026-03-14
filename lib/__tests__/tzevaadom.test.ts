import { normalizeTzevaadomCity, TZEVAADOM_ALLOWED_CODES, fetchTzevaadomHistory, fetchTzevaadomRaw } from '../tzevaadom'
import type { TzevaadomEntry } from '../tzevaadom'
import { tzevaadomRaw } from '@/tests/fixtures/tzevaadomRaw'

beforeAll(() => {
  // jsdom does not define fetch on global; we must define it so jest.spyOn can replace it
  if (!('fetch' in global)) {
    ;(global as unknown as Record<string, unknown>).fetch = () => Promise.resolve()
  }
})

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('normalizeTzevaadomCity', () => {
  it('maps known Ashdod variant to correct spelling', () => {
    expect(normalizeTzevaadomCity('אשדוד -יא,יב,טו,יז,מרינה,סיט')).toBe('אשדוד -יא,יב,טו,יז,מרינה,סיטי')
  })

  it('returns unknown city names unchanged', () => {
    expect(normalizeTzevaadomCity('תל אביב - מרכז העיר')).toBe('תל אביב - מרכז העיר')
  })
})

describe('TZEVAADOM_ALLOWED_CODES', () => {
  it('contains code 0', () => {
    expect(TZEVAADOM_ALLOWED_CODES.has(0)).toBe(true)
  })

  it('contains code 5', () => {
    expect(TZEVAADOM_ALLOWED_CODES.has(5)).toBe(true)
  })

  it('does NOT contain code 99', () => {
    expect(TZEVAADOM_ALLOWED_CODES.has(99)).toBe(false)
  })
})

describe('fetchTzevaadomRaw', () => {
  it('returns the raw array from fetch as-is', async () => {
    const mockData: TzevaadomEntry[] = [[101, 0, ['תל אביב'], 1000000000]]
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)
    const result = await fetchTzevaadomRaw()
    expect(result).toEqual(mockData)
  })
})

describe('fetchTzevaadomHistory', () => {
  function mockFetch(data: unknown) {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    } as Response)
  }

  it('maps entries to one AlarmHistoryItem per city per entry', async () => {
    mockFetch(tzevaadomRaw)
    const result = await fetchTzevaadomHistory()
    // tzevaadomRaw has: entry[0] 1 city, entry[1] 2 cities, entry[2] 1 city, entry[3] skipped (code 99)
    expect(result).toHaveLength(4)
  })

  it('skips entries with unknown category codes', async () => {
    mockFetch(tzevaadomRaw)
    const result = await fetchTzevaadomHistory()
    // entry with code 99 (rid 104) should be filtered out
    const ridPresent = result.map((r) => r.rid)
    expect(ridPresent).not.toContain(104)
  })

  it('applies city normalization to the data field', async () => {
    mockFetch(tzevaadomRaw)
    const result = await fetchTzevaadomHistory()
    // entry[1] has 'אשדוד -יא,יב,טו,יז,מרינה,סיט' which should be normalized
    const ashdodItem = result.find((r) => r.rid === 102 && r.data.includes('אשדוד'))
    expect(ashdodItem).toBeDefined()
    expect(ashdodItem!.data).toBe('אשדוד -יא,יב,טו,יז,מרינה,סיטי')
  })

  it('converts Unix timestamp to Israel time alertDate in YYYY-MM-DDTHH:MM:SS format', async () => {
    // ts=1000000000 is 2001-09-09T01:46:40 UTC = 2001-09-09T04:46:40 Israel/IDT (UTC+3)
    const singleEntry = [[999, 0, ['תל אביב'], 1000000000]]
    mockFetch(singleEntry)
    const result = await fetchTzevaadomHistory()
    expect(result).toHaveLength(1)
    const alertDate = result[0].alertDate
    // Verify format YYYY-MM-DDTHH:MM:SS
    expect(alertDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    // The date should be 2001-09-09 in Israel time
    expect(alertDate.startsWith('2001-09-09')).toBe(true)
    // Israel time (IDT = UTC+3) means 01:46:40 UTC → 04:46:40 local
    expect(alertDate).toBe('2001-09-09T04:46:40')
  })

  it('throws when fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)
    await expect(fetchTzevaadomHistory()).rejects.toThrow('Failed to fetch tzevaadom data: 500')
  })
})

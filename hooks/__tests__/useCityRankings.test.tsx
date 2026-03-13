import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCityRankings } from '../useCityRankings'
import { tzevaadomRaw as FIXTURE_TZEVAADOM_RAW } from '@/tests/fixtures/tzevaadomRaw'
import { cities as FIXTURE_CITIES } from '@/tests/fixtures/cities'

function makeWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    )
  }
}

function setupFetch() {
  global.fetch = jest.fn().mockImplementation((url: RequestInfo | URL) => {
    const u = String(url)
    if (u.includes('/api/tzevaadom')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_TZEVAADOM_RAW) } as Response)
    }
    if (u.includes('/api/cities')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_CITIES) } as Response)
    }
    return Promise.reject(new Error(`Unmocked URL: ${u}`))
  }) as jest.Mock
}

afterEach(() => {
  jest.restoreAllMocks()
})

// Helper to get city count from results
function getCount(cities: Array<{ label: string; count: number }>, label: string): number {
  return cities.find((c) => c.label === label)?.count ?? 0
}

describe('useCityRankings', () => {
  // Test 1: counts alerts within fromTs–toTs window
  it('counts alerts within fromTs–toTs window', async () => {
    setupFetch()
    const { result } = renderHook(() => useCityRankings('he', 1500, 2500), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // Only ts=2000 entry is in range [1500, 2500]
    // ts=1000 (Tel Aviv) should be excluded
    // ts=3000 (Jerusalem) should be excluded
    // ts=2000 has Jerusalem and Ashdod (normalized)
    expect(getCount(cities, 'ירושלים')).toBe(1)
    // Tel Aviv from ts=1000 should not appear (out of range)
    expect(getCount(cities, 'תל אביב - מרכז העיר')).toBe(0)
  })

  // Test 2: fromTs boundary is inclusive
  it('fromTs boundary is inclusive — entry at exactly fromTs is counted', async () => {
    setupFetch()
    const { result } = renderHook(() => useCityRankings('he', 2000, 2000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // ts=2000 should be included (fromTs=2000, toTs=2000 → exactly the boundary entry)
    expect(getCount(cities, 'ירושלים')).toBe(1)
  })

  // Test 3: toTs boundary is inclusive
  it('toTs boundary is inclusive — entry at exactly toTs is counted', async () => {
    setupFetch()
    const { result } = renderHook(() => useCityRankings('he', 1000, 3000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // ts=3000 entry (Jerusalem) should be included (toTs=3000, ts=3000 → ts <= toTs)
    // Jerusalem appears at ts=2000 and ts=3000, total should be 2
    expect(getCount(cities, 'ירושלים')).toBe(2)
  })

  // Test 4: alert before fromTs is excluded
  it('alert before fromTs is excluded', async () => {
    setupFetch()
    // ts=1000 entry has Tel Aviv; with fromTs=1001 it should be excluded
    const { result } = renderHook(() => useCityRankings('he', 1001, 3000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // Tel Aviv only appears at ts=1000 which is before fromTs=1001
    expect(getCount(cities, 'תל אביב - מרכז העיר')).toBe(0)
  })

  // Test 5: alert after toTs is excluded
  it('alert after toTs is excluded', async () => {
    setupFetch()
    // ts=3000 entry has Jerusalem; with toTs=2999 it should be excluded
    const { result } = renderHook(() => useCityRankings('he', 1000, 2999), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // Jerusalem appears at ts=2000 (included) and ts=3000 (excluded)
    // So Jerusalem count should be exactly 1 (not 2)
    expect(getCount(cities, 'ירושלים')).toBe(1)
  })

  // Test 6: disallowed category codes are excluded
  it('disallowed category code 99 is excluded even when within range', async () => {
    setupFetch()
    // ts=2500 entry (code=99) has Tel Aviv; ts=1000 (code=0) also has Tel Aviv
    // With range [1000, 3000]: ts=1000 and ts=2500 are both in range,
    // but only ts=1000 should contribute (code=0 is allowed, code=99 is not)
    const { result } = renderHook(() => useCityRankings('he', 1000, 3000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // Tel Aviv appears at ts=1000 (allowed) and ts=2500 (code=99, disallowed)
    // So count should be 1, not 2
    expect(getCount(cities, 'תל אביב - מרכז העיר')).toBe(1)
  })

  // Test 7: city name normalization
  it('normalizes bad Ashdod spelling to canonical form', async () => {
    setupFetch()
    // ts=2000 has 'אשדוד -יא,יב,טו,יז,מרינה,סיט' (without trailing י)
    // normalizeTzevaadomCity should produce 'אשדוד -יא,יב,טו,יז,מרינה,סיטי' (with trailing י)
    const { result } = renderHook(() => useCityRankings('he', 2000, 2000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    // Should appear under normalized name (with trailing י)
    expect(getCount(cities, 'אשדוד -יא,יב,טו,יז,מרינה,סיטי')).toBe(1)
    // Should NOT appear under bad spelling
    expect(getCount(cities, 'אשדוד -יא,יב,טו,יז,מרינה,סיט')).toBe(0)
  })

  // Test 8: Hebrew mode returns Hebrew city names
  it('Hebrew mode returns Hebrew city names as labels', async () => {
    setupFetch()
    const { result } = renderHook(() => useCityRankings('he', 1000, 3000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    const labels = cities.map((c) => c.label)
    expect(labels).toContain('תל אביב - מרכז העיר')
    expect(labels).toContain('ירושלים')
    // Should NOT contain English labels in Hebrew mode
    expect(labels).not.toContain('Tel Aviv - City Center')
    expect(labels).not.toContain('Jerusalem')
  })

  // Test 9: English mode maps Hebrew names to English via label_he
  it('English mode maps Hebrew city names to English using FIXTURE_CITIES label_he', async () => {
    setupFetch()
    const { result } = renderHook(() => useCityRankings('en', 1000, 3000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    const labels = cities.map((c) => c.label)
    // Hebrew names should be mapped to English
    expect(labels).toContain('Tel Aviv - City Center')
    expect(labels).toContain('Jerusalem')
    // Hebrew originals should not appear (they were mapped)
    expect(labels).not.toContain('תל אביב - מרכז העיר')
    expect(labels).not.toContain('ירושלים')
  })

  // Test 10: unknown city in English mode keeps Hebrew name
  it('English mode: unknown city not in heToEn map keeps its Hebrew name', async () => {
    setupFetch()
    // 'אשדוד -יא,יב,טו,יז,מרינה,סיטי' (normalized) is NOT in FIXTURE_CITIES
    // so it should fall back to the Hebrew name
    const { result } = renderHook(() => useCityRankings('en', 2000, 2000), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const { cities } = result.current
    const labels = cities.map((c) => c.label)
    // Ashdod is not in FIXTURE_CITIES, so it falls back to Hebrew
    expect(labels).toContain('אשדוד -יא,יב,טו,יז,מרינה,סיטי')
    // Jerusalem IS in FIXTURE_CITIES so it should be mapped to English
    expect(labels).toContain('Jerusalem')
    expect(labels).not.toContain('ירושלים')
  })
})

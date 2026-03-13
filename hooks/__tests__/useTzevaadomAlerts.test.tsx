import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTzevaadomAlerts } from '../useTzevaadomAlerts'
import { tzevaadomRaw as FIXTURE_TZEVAADOM_RAW } from '@/tests/fixtures/tzevaadomRaw'
import type { TzevaadomEntry } from '@/lib/tzevaadom'

function makeWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    )
  }
}

afterEach(() => {
  jest.resetAllMocks()
})

describe('useTzevaadomAlerts', () => {
  // Test 1: enabled=false → fetch not called
  it('does not call fetch when enabled=false', () => {
    global.fetch = jest.fn()

    renderHook(() => useTzevaadomAlerts({ enabled: false }), {
      wrapper: makeWrapper(),
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  // Test 2: enabled=true → fetches /api/tzevaadom, returns mapped AlarmHistoryItem[]
  it('fetches /api/tzevaadom and returns mapped AlarmHistoryItem[] when enabled=true', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tzevaadom')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(FIXTURE_TZEVAADOM_RAW),
        } as Response)
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result } = renderHook(() => useTzevaadomAlerts({ enabled: true }), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // FIXTURE_TZEVAADOM_RAW breakdown:
    // ts=1000, code=0 (allowed): 1 city → 1 item
    // ts=2000, code=5 (allowed): 2 cities → 2 items
    // ts=3000, code=0 (allowed): 1 city → 1 item
    // ts=2500, code=99 (disallowed): skipped → 0 items
    // Total: 4 items
    expect(result.current.alerts).toHaveLength(4)
    expect(result.current.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/api/tzevaadom')
  })

  // Test 3: city normalization
  it('normalizes bad Ashdod spelling to canonical form', async () => {
    const rawWithBadSpelling: TzevaadomEntry[] = [
      [99, 0, ['אשדוד -יא,יב,טו,יז,מרינה,סיט'], 2000],
    ]

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tzevaadom')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(rawWithBadSpelling),
        } as Response)
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result } = renderHook(() => useTzevaadomAlerts({ enabled: true }), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.alerts[0].data).toBe('אשדוד -יא,יב,טו,יז,מרינה,סיטי')
  })

  // Test 4: Fetch error → error message populated, alerts=[]
  it('returns error message and empty alerts on fetch error', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/tzevaadom')) {
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response)
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result } = renderHook(() => useTzevaadomAlerts({ enabled: true }), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeTruthy()
    expect(result.current.error).toContain('500')
    expect(result.current.alerts).toEqual([])
  })
})

import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAlerts } from '../useAlerts'
import { alertHistory as FIXTURE_ALERTS } from '@/tests/fixtures/alertHistory'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

function makeOkResponse(data: unknown): Response {
  return {
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response
}

afterEach(() => {
  jest.resetAllMocks()
})

describe('useAlerts', () => {
  // Test 1: enabled=false → fetch never called
  it('does not call fetch when enabled=false', () => {
    global.fetch = jest.fn()

    const { result } = renderHook(() => useAlerts({ mode: 1, enabled: false }), { wrapper: makeWrapper() })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.alerts).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  // Test 2: enabled=true → fetch called, returns alerts array
  it('fetches alert history and returns alerts when enabled=true', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/history')) {
        return Promise.resolve(makeOkResponse(FIXTURE_ALERTS))
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result } = renderHook(() => useAlerts({ mode: 1 }), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.alerts).toEqual(FIXTURE_ALERTS)
    expect(result.current.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/history'),
      expect.objectContaining({ cache: 'no-store' })
    )
  })

  // Test 3: loading=true initially (before fetch resolves)
  it('loading is true initially before fetch resolves', async () => {
    let resolvePromise!: (value: Response) => void
    const deferred = new Promise<Response>((resolve) => {
      resolvePromise = resolve
    })

    global.fetch = jest.fn().mockReturnValue(deferred)

    const { result } = renderHook(() => useAlerts({ mode: 1 }), { wrapper: makeWrapper() })

    expect(result.current.loading).toBe(true)

    // Resolve the deferred promise
    await act(async () => {
      resolvePromise(makeOkResponse(FIXTURE_ALERTS))
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  // Test 4 (was 5): Fetch error → error populated, alerts=[]
  it('populates error and returns empty alerts on fetch error', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/history')) {
        return Promise.resolve({ ok: false, status: 500 } as Response)
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result } = renderHook(() => useAlerts({ mode: 1 }), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeTruthy()
    expect(result.current.error).toContain('500')
    expect(result.current.alerts).toEqual([])
  })

  // Test 6: retry() re-triggers the fetch (call count 1 → 2)
  it('retry() re-triggers the fetch', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/history')) {
        return Promise.resolve(makeOkResponse(FIXTURE_ALERTS))
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result } = renderHook(() => useAlerts({ mode: 1 }), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.retry()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  // Test 7: Params change → new fetch triggered
  it('triggers a new fetch when mode param changes', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/history')) {
        return Promise.resolve(makeOkResponse(FIXTURE_ALERTS))
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 0 | 1 | 2 | 3 }) => useAlerts({ mode }),
      { initialProps: { mode: 1 as 0 | 1 | 2 | 3 }, wrapper: makeWrapper() }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledTimes(1)

    rerender({ mode: 2 })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  // Test 8: Stale data guard — during re-fetch after params change, alerts is []
  it('returns empty alerts (stale data guard) while re-fetching after params change', async () => {
    let resolveSecond!: (value: Response) => void
    let callCount = 0

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/history')) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(makeOkResponse(FIXTURE_ALERTS))
        }
        // Second call: deferred
        return new Promise<Response>((resolve) => {
          resolveSecond = resolve
        })
      }
      return Promise.reject(new Error('Unmocked URL: ' + url))
    })

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 0 | 1 | 2 | 3 }) => useAlerts({ mode }),
      { initialProps: { mode: 1 as 0 | 1 | 2 | 3 }, wrapper: makeWrapper() }
    )

    // Wait for the first fetch to settle with data
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.alerts).toEqual(FIXTURE_ALERTS)

    // Change params — triggers second fetch (deferred)
    rerender({ mode: 2 })

    // Stale data guard: during the pending re-fetch, alerts must be []
    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.alerts).toEqual([])

    // Resolve the second fetch
    await act(async () => {
      resolveSecond(makeOkResponse(FIXTURE_ALERTS))
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.alerts).toEqual(FIXTURE_ALERTS)
  })
})

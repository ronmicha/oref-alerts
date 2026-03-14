import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRealtimeAlerts } from '../useRealtimeAlerts'

// Mock lib/oref
jest.mock('@/lib/oref', () => ({
  fetchAlertHistory: jest.fn(),
}))

import { fetchAlertHistory } from '@/lib/oref'
const mockFetch = fetchAlertHistory as jest.MockedFunction<typeof fetchAlertHistory>

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

// Fixed "now" for deterministic 10-min window tests
const NOW = new Date('2026-03-14T12:00:00.000Z').getTime()

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  mockFetch.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useRealtimeAlerts', () => {
  it('returns loading=true initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    expect(result.current.loading).toBe(true)
    expect(result.current.cityAlerts.size).toBe(0)
    expect(result.current.lastUpdated).toBeNull()
  })

  it('returns empty cityAlerts when API returns []', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.cityAlerts.size).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('filters out alerts older than 10 minutes', async () => {
    // 5 min ago = within window; 15 min ago = outside window
    const fiveMinsAgo = new Date(NOW - 5 * 60 * 1000).toISOString().slice(0, 19)
    const fifteenMinsAgo = new Date(NOW - 15 * 60 * 1000).toISOString().slice(0, 19)

    mockFetch.mockResolvedValue([
      {
        data: 'תל אביב',
        date: '14/03/2026',
        time: '11:55:00',
        alertDate: fiveMinsAgo,
        category: 1,
        category_desc: 'ירי רקטות וטילים',
        matrix_id: 1,
        rid: 1,
      },
      {
        data: 'ירושלים',
        date: '14/03/2026',
        time: '11:45:00',
        alertDate: fifteenMinsAgo,
        category: 1,
        category_desc: 'ירי רקטות וטילים',
        matrix_id: 1,
        rid: 2,
      },
    ])

    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.cityAlerts.size).toBe(1)
    expect(result.current.cityAlerts.has('תל אביב')).toBe(true)
    expect(result.current.cityAlerts.has('ירושלים')).toBe(false)
  })

  it('groups multiple categories for the same city', async () => {
    const recentTs = new Date(NOW - 2 * 60 * 1000).toISOString().slice(0, 19)

    mockFetch.mockResolvedValue([
      {
        data: 'תל אביב',
        date: '14/03/2026',
        time: '11:58:00',
        alertDate: recentTs,
        category: 1, // missile
        category_desc: 'ירי רקטות וטילים',
        matrix_id: 1,
        rid: 10,
      },
      {
        data: 'תל אביב',
        date: '14/03/2026',
        time: '11:59:00',
        alertDate: recentTs,
        category: 2, // uav
        category_desc: 'חדירת כלי טיס עוין',
        matrix_id: 6,
        rid: 11,
      },
    ])

    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const ta = result.current.cityAlerts.get('תל אביב')
    expect(ta).toBeDefined()
    expect(ta!.categories.has(1)).toBe(true)
    expect(ta!.categories.has(2)).toBe(true)
  })

  it('returns error string when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network error')
  })

  it('sets lastUpdated after successful fetch', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useRealtimeAlerts(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  it('passes lang to fetchAlertHistory', async () => {
    mockFetch.mockResolvedValue([])
    const { result } = renderHook(() => useRealtimeAlerts({ lang: 'en' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFetch).toHaveBeenCalledWith({ mode: 1, lang: 'en' })
  })
})

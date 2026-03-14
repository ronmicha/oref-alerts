'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAlertHistory } from '@/lib/oref'
import type { AlarmHistoryItem } from '@/types/oref'

const TEN_MINUTES_MS = 10 * 60 * 1000

interface UseRealtimeAlertsOptions {
  lang?: 'he' | 'en'
}

interface RealtimeAlert {
  city: string
  categories: Set<number>
}

export interface UseRealtimeAlertsResult {
  /** Alerts from the last 10 minutes, grouped by city */
  cityAlerts: Map<string, RealtimeAlert>
  /** Raw alerts returned by the API (full mode=1 window, unfiltered) */
  rawAlerts: AlarmHistoryItem[]
  /** Timestamp of the last successful fetch, or null before first fetch */
  lastUpdated: Date | null
  loading: boolean
  error: string | null
}

/**
 * Polls Oref mode=1 (last 24h) every 30 seconds.
 * Filters client-side to the last 10 minutes and groups by city.
 *
 * alertDate format: "YYYY-MM-DDTHH:MM:SS" — Israel local time (Asia/Jerusalem).
 * new Date(alertDate) is treated as LOCAL time by the JS engine, which works
 * correctly when the user's device is in Israel or the server is running TZ=Asia/Jerusalem.
 */
export function useRealtimeAlerts({ lang = 'he' }: UseRealtimeAlertsOptions = {}): UseRealtimeAlertsResult {
  const { data, dataUpdatedAt, isLoading, error } = useQuery<AlarmHistoryItem[]>({
    queryKey: ['realtime-alerts', lang],
    queryFn: () => fetchAlertHistory({ mode: 1, lang }),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const rawAlerts = data ?? []

  const cityAlerts = new Map<string, RealtimeAlert>()

  if (rawAlerts.length > 0) {
    const cutoff = Date.now() - TEN_MINUTES_MS
    for (const alert of rawAlerts) {
      const alertTs = new Date(alert.alertDate).getTime()
      if (alertTs < cutoff) continue
      const existing = cityAlerts.get(alert.data)
      if (existing) {
        existing.categories.add(alert.category)
      } else {
        cityAlerts.set(alert.data, { city: alert.data, categories: new Set([alert.category]) })
      }
    }
  }

  return {
    cityAlerts,
    rawAlerts,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}

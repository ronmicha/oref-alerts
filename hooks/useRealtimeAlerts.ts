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
  categories: ReadonlySet<number>
  /** Most recent alertDate string per category, for the click popup */
  latestByCategory: ReadonlyMap<number, string>
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
 * Polls Oref mode=1 (last 24h) every 10 seconds.
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
    refetchInterval: 10_000,
    staleTime: 0,
  })

  const rawAlerts = data ?? []

  const mutableAlerts = new Map<string, { city: string; categories: Set<number>; latestByCategory: Map<number, string> }>()

  const cutoff = Date.now() - TEN_MINUTES_MS
  for (const alert of rawAlerts) {
    const alertTs = new Date(alert.alertDate).getTime()
    if (alertTs < cutoff) continue
    const existing = mutableAlerts.get(alert.data)
    if (existing) {
      existing.categories.add(alert.category)
      const prev = existing.latestByCategory.get(alert.category)
      if (!prev || alert.alertDate > prev) {
        existing.latestByCategory.set(alert.category, alert.alertDate)
      }
    } else {
      mutableAlerts.set(alert.data, {
        city: alert.data,
        categories: new Set([alert.category]),
        latestByCategory: new Map([[alert.category, alert.alertDate]]),
      })
    }
  }

  const cityAlerts: Map<string, RealtimeAlert> = mutableAlerts

  return {
    cityAlerts,
    rawAlerts,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}

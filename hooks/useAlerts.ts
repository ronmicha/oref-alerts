'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAlertHistory } from '@/lib/oref'
import type { AlarmHistoryItem } from '@/types/oref'

interface UseAlertsOptions {
  mode: 0 | 1 | 2 | 3
  city?: string
  lang?: 'he' | 'en'
  fromDate?: string
  toDate?: string
  enabled?: boolean
}

export function useAlerts({ mode, city, lang = 'he', fromDate, toDate, enabled = true }: UseAlertsOptions) {
  const { data, isLoading, error, refetch } = useQuery<AlarmHistoryItem[]>({
    queryKey: ['alerts', mode, city ?? '', lang, fromDate ?? '', toDate ?? ''],
    queryFn: () => fetchAlertHistory({ mode, city, lang, fromDate, toDate }),
    enabled,
    refetchInterval: 30_000,
    staleTime: 0,
  })

  return {
    alerts: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    retry: refetch,
  }
}

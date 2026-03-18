'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchTzevaadomHistory } from '@/lib/tzevaadom'
import type { AlarmHistoryItem } from '@/types/oref'

export function useTzevaadomAlerts({ enabled = false } = {}) {
  const { data: alerts = [], isLoading, error, refetch } = useQuery<AlarmHistoryItem[]>({
    queryKey: ['tzevaadom'],
    queryFn: fetchTzevaadomHistory,
    enabled,
    refetchInterval: 30_000,
    staleTime: 0,
  })

  return { alerts, loading: isLoading, error: error?.message ?? null, refetch }
}

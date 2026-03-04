'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchAlertHistory } from '@/lib/oref'
import type { AlarmHistoryItem } from '@/types/oref'

interface UseAlertsOptions {
  mode: 0 | 1 | 2 | 3
  city?: string
  lang?: 'he' | 'en'
  fromDate?: string
  toDate?: string
}

export function useAlerts({ mode, city, lang = 'he', fromDate, toDate }: UseAlertsOptions) {
  const [alerts, setAlerts] = useState<AlarmHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAlertHistory({ mode, city, lang, fromDate, toDate })
      .then(setAlerts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [mode, city, lang, fromDate, toDate])

  useEffect(() => {
    load()
  }, [load])

  return { alerts, loading, error, retry: load }
}

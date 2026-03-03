'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchAlertHistory } from '@/lib/oref'
import type { AlarmHistoryItem } from '@/types/oref'

export function useAlerts(mode: 1 | 2 | 3, city?: string) {
  const [alerts, setAlerts] = useState<AlarmHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAlertHistory(mode, city)
      .then(setAlerts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [mode, city])

  useEffect(() => {
    load()
  }, [load])

  return { alerts, loading, error, retry: load }
}

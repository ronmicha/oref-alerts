'use client'

import { useState, useEffect } from 'react'
import { fetchTzevaadomHistory } from '@/lib/tzevaadom'
import type { AlarmHistoryItem } from '@/types/oref'

export function useTzevaadomAlerts({ enabled = false } = {}) {
  const [alerts, setAlerts] = useState<AlarmHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    fetchTzevaadomHistory()
      .then(setAlerts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [enabled])

  return { alerts, loading, error }
}

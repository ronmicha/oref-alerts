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
  enabled?: boolean
}

function paramsKey(mode: number, city?: string, lang = 'he', fromDate?: string, toDate?: string, enabled = true) {
  return `${enabled}-${mode}-${city ?? ''}-${lang}-${fromDate ?? ''}-${toDate ?? ''}`
}

export function useAlerts({ mode, city, lang = 'he', fromDate, toDate, enabled = true }: UseAlertsOptions) {
  const currentKey = paramsKey(mode, city, lang, fromDate, toDate, enabled)

  const [alerts, setAlerts] = useState<AlarmHistoryItem[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  // Track which params produced the current alerts — lets us detect stale data
  // synchronously on the render before the async effect has had a chance to run.
  const [fetchedKey, setFetchedKey] = useState(currentKey)

  const load = useCallback(() => {
    if (!enabled) {
      setAlerts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchAlertHistory({ mode, city, lang, fromDate, toDate })
      .then((data) => {
        setAlerts(data)
        setFetchedKey(paramsKey(mode, city, lang, fromDate, toDate, enabled))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [mode, city, lang, fromDate, toDate, enabled])

  useEffect(() => {
    load()
  }, [load])

  // If params changed but the fetch hasn't started yet (effect deferred after paint),
  // treat alerts as empty and loading as true — prevents stale data from leaking out.
  const isCurrent = fetchedKey === currentKey
  return {
    alerts: isCurrent ? alerts : [],
    loading: loading || !isCurrent,
    error: isCurrent ? error : null,
    retry: load,
  }
}

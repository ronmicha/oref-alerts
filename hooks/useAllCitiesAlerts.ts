'use client'

import { useState, useEffect } from 'react'
import { fetchAlertHistory } from '@/lib/oref'

export interface CityCount {
  label: string
  count: number
}

/**
 * Fetches 7-day alert counts for every city in parallel (up to 20 concurrent).
 * Results stream into state as cities complete; only cities with count > 0 are included.
 */
export function useAllCitiesAlerts(cityLabels: string[], lang: 'he' | 'en') {
  const [cities, setCities] = useState<CityCount[]>([])
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!cityLabels.length) return

    setCities([])
    setLoaded(0)
    setDone(false)
    setTotal(cityLabels.length)

    let cancelled = false
    let index = 0
    let loadedCount = 0
    const pending: CityCount[] = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    function flush() {
      if (cancelled) return
      const batch = pending.splice(0)
      if (batch.length > 0) setCities((prev) => [...prev, ...batch])
      setLoaded(loadedCount)
      flushTimer = null
    }

    function scheduleFlush() {
      if (!flushTimer) flushTimer = setTimeout(flush, 150)
    }

    async function worker() {
      while (!cancelled) {
        const i = index++
        if (i >= cityLabels.length) break
        try {
          const alerts = await fetchAlertHistory({ mode: 2, city: cityLabels[i], lang })
          if (!cancelled) {
            loadedCount++
            if (alerts.length > 0) pending.push({ label: cityLabels[i], count: alerts.length })
            scheduleFlush()
          }
        } catch {
          if (!cancelled) {
            loadedCount++
            scheduleFlush()
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(20, cityLabels.length) }, () => worker())

    Promise.all(workers).then(() => {
      if (!cancelled) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        flush()
        setDone(true)
      }
    })

    return () => {
      cancelled = true
      if (flushTimer) clearTimeout(flushTimer)
    }
  }, [cityLabels, lang])

  return { cities, loaded, total, done }
}

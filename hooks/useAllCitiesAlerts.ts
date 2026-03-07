'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchAlertHistory } from '@/lib/oref'

export interface CityCount {
  label: string
  count: number
}

// Cache key — derived from actual city labels (first 5), not raw lang.
// This ensures the cache only fires when the right-language labels have arrived,
// preventing a race where lang='en' but cityLabels still holds Hebrew names.
export function cityAlertsQueryKey(cityLabels: string[]) {
  return ['cityAlerts', cityLabels.slice(0, 5).join(',')]
}

/**
 * Fetches 7-day alert counts for every city in parallel (up to 20 concurrent).
 * Results stream into state as cities complete; only cities with count > 0 are included.
 * Results are cached via React Query — switching languages then back is instant.
 */
export function useAllCitiesAlerts(cityLabels: string[], lang: 'he' | 'en') {
  const queryClient = useQueryClient()

  const cached = queryClient.getQueryData<CityCount[]>(cityAlertsQueryKey(cityLabels))

  const [cities, setCities] = useState<CityCount[]>(cached ?? [])
  const [loaded, setLoaded] = useState(cached?.length ?? 0)
  const [total, setTotal] = useState(cached?.length ?? 0)
  const [done, setDone] = useState(!!cached)

  useEffect(() => {
    if (!cityLabels.length) return

    // Cache hit — restore instantly
    const hit = queryClient.getQueryData<CityCount[]>(cityAlertsQueryKey(cityLabels))
    if (hit) {
      setCities(hit)
      setLoaded(hit.length)
      setTotal(hit.length)
      setDone(true)
      return
    }

    setCities([])
    setLoaded(0)
    setDone(false)
    setTotal(cityLabels.length)

    let cancelled = false
    let index = 0
    let loadedCount = 0
    const pending: CityCount[] = []
    const allResults: CityCount[] = []
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
            if (alerts.length > 0) {
              const entry: CityCount = { label: cityLabels[i], count: alerts.length }
              pending.push(entry)
              allResults.push(entry)
            }
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
        queryClient.setQueryData(cityAlertsQueryKey(cityLabels), allResults)
        setDone(true)
      }
    })

    return () => {
      cancelled = true
      if (flushTimer) clearTimeout(flushTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityLabels, lang])

  return { cities, loaded, total, done }
}

'use client'

import { useState, useEffect } from 'react'
import { fetchAlertHistory } from '@/lib/oref'

export interface CityCount {
  label: string
  count: number
}

// Module-level session cache keyed by lang.
// Persists for the lifetime of the page session — switching languages then back is instant.
const citiesCache = new Map<string, CityCount[]>()

/**
 * Fetches 7-day alert counts for every city in parallel (up to 20 concurrent).
 * Results stream into state as cities complete; only cities with count > 0 are included.
 * Results are cached per language — re-selecting a previously loaded language is instant.
 */
export function useAllCitiesAlerts(cityLabels: string[], lang: 'he' | 'en') {
  const [cities, setCities] = useState<CityCount[]>(() => citiesCache.get(lang) ?? [])
  const [loaded, setLoaded] = useState(() => citiesCache.get(lang)?.length ?? 0)
  const [total, setTotal] = useState(() => citiesCache.get(lang)?.length ?? 0)
  const [done, setDone] = useState(() => citiesCache.has(lang))

  useEffect(() => {
    if (!cityLabels.length) return

    // Cache hit: restore instantly without re-fetching
    if (citiesCache.has(lang)) {
      const data = citiesCache.get(lang)!
      setCities(data)
      setLoaded(data.length)
      setTotal(data.length)
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
    const allResults: CityCount[] = [] // accumulates everything for the cache
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
        citiesCache.set(lang, allResults)
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

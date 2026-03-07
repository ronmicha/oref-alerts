'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchAlertHistory } from '@/lib/oref'

export interface CityCount {
  label: string
  count: number
}

// Cache key — keyed by language, not by label strings.
// This ensures switching back to a previously loaded language is instant.
export function cityAlertsQueryKey(lang: string) {
  return ['cityAlerts', lang]
}

// Returns true when cityLabels appear to be in the expected language.
// Prevents fetching with mismatched lang+cityLabels during a language switch race.
function labelsMatchLang(labels: string[], lang: 'he' | 'en') {
  if (!labels.length) return false
  const hasHebrew = /[\u0590-\u05FF]/.test(labels[0])
  return lang === 'he' ? hasHebrew : !hasHebrew
}

/**
 * Fetches 7-day alert counts for every city in parallel (up to 20 concurrent).
 * Results stream into state as cities complete; only cities with count > 0 are included.
 * Results are cached via React Query per language — switching languages then back is instant.
 */
export function useAllCitiesAlerts(cityLabels: string[], lang: 'he' | 'en') {
  const queryClient = useQueryClient()

  const cached = queryClient.getQueryData<CityCount[]>(cityAlertsQueryKey(lang))

  const [cities, setCities] = useState<CityCount[]>(cached ?? [])
  const [loaded, setLoaded] = useState(cached?.length ?? 0)
  const [total, setTotal] = useState(cached?.length ?? 0)
  const [done, setDone] = useState(!!cached)

  useEffect(() => {
    // Fast path: cache hit — restore instantly (even before labels settle for new lang)
    const hit = queryClient.getQueryData<CityCount[]>(cityAlertsQueryKey(lang))
    if (hit) {
      setCities(hit)
      setLoaded(hit.length)
      setTotal(hit.length)
      setDone(true)
      return
    }

    // Labels haven't settled for the current lang yet — show empty, wait for next render
    if (!labelsMatchLang(cityLabels, lang)) {
      setCities([])
      setLoaded(0)
      setTotal(0)
      setDone(false)
      return
    }

    // Cache miss + labels settled for lang — start progressive fetch
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
        queryClient.setQueryData(cityAlertsQueryKey(lang), allResults)
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

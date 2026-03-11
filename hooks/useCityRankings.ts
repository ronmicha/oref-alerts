'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTzevaadomRaw, TZEVAADOM_ALLOWED_CODES, normalizeTzevaadomCity } from '@/lib/tzevaadom'
import { fetchCities } from '@/lib/oref'
import type { CityCount } from '@/types/oref'

/**
 * Returns per-city alert counts for alerts from fromTs (Unix seconds) to now,
 * using the tzevaadom dataset (one 1.7 MB fetch, React Query cached).
 *
 * For English mode the Hebrew city names from tzevaadom are mapped to
 * English using the label_he field present in oref's English city list.
 */
export function useCityRankings(lang: 'he' | 'en', fromTs: number) {
  const { data: raw, isLoading: rawLoading, error: rawError, refetch } = useQuery({
    queryKey: ['tzevaadomRaw'],
    queryFn: fetchTzevaadomRaw,
    staleTime: 30 * 60 * 1000, // 30 min — matches /api/tzevaadom s-maxage
  })

  // The English city list includes label_he on every entry, giving us a
  // complete he→en mapping with one API call regardless of the active language.
  const { data: enCities, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', 'en'],
    queryFn: () => fetchCities('en'),
    staleTime: Infinity,
  })

  const heToEn = useMemo(
    () => enCities ? new Map(enCities.map((c) => [c.label_he, c.label])) : null,
    [enCities],
  )

  const cities = useMemo<CityCount[]>(() => {
    if (!raw || !heToEn) return []
    const counts = new Map<string, number>()
    for (const [, code, cityArr, ts] of raw) {
      if (!TZEVAADOM_ALLOWED_CODES.has(code)) continue
      if (ts < fromTs) continue
      for (const rawCity of cityArr) {
        const heCity = normalizeTzevaadomCity(rawCity)
        const label = lang === 'en' ? (heToEn.get(heCity) ?? heCity) : heCity
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }))
  }, [raw, heToEn, lang, fromTs])

  return {
    cities,
    loading: rawLoading || citiesLoading,
    error: rawError ? (rawError as Error).message : null,
    refetch,
  }
}

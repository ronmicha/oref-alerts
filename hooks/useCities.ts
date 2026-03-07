'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCities } from '@/lib/oref'
import type { City } from '@/types/oref'

export function useCities(lang: 'he' | 'en' = 'he') {
  const { data: cities = [], isLoading, error } = useQuery<City[]>({
    queryKey: ['cities', lang],
    queryFn: () => fetchCities(lang),
  })

  // React Query returns the same `cities` reference until data changes,
  // so this memo produces a stable cityLabels array for downstream hooks.
  const cityLabels = useMemo(() =>
    [...new Set(
      cities
        .filter((c) => !c.label.includes('כל האזורים') && !c.label.includes('כל - האזורים') && !c.label.toLowerCase().includes('all areas'))
        .map((c) => c.label)
    )].sort(),
  [cities])

  return { cities, cityLabels, loading: isLoading, error: error?.message ?? null }
}

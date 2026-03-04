'use client'

import { useState, useEffect } from 'react'
import { fetchCities } from '@/lib/oref'
import type { City } from '@/types/oref'

export function useCities(lang: 'he' | 'en' = 'he') {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchCities(lang)
      .then(setCities)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [lang])

  // Unique city labels sorted alphabetically, excluding area-wide entries that return no results
  const cityLabels = [...new Set(
    cities.filter((c) => !c.label.includes('כל האזורים')).map((c) => c.label)
  )].sort()

  return { cities, cityLabels, loading, error }
}

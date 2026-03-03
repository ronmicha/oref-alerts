'use client'

import { useState, useEffect } from 'react'
import { fetchCities } from '@/lib/oref'
import type { City } from '@/types/oref'

export function useCities() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Unique city labels sorted alphabetically (label format: "CityName | AreaName")
  const cityLabels = [...new Set(cities.map((c) => c.label))].sort()

  return { cities, cityLabels, loading, error }
}

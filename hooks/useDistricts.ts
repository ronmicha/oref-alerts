'use client'

import { useState, useEffect } from 'react'
import { fetchDistricts } from '@/lib/oref'
import type { District } from '@/types/oref'

export function useDistricts() {
  const [districts, setDistricts] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDistricts()
      .then(setDistricts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Extract unique area names, sorted alphabetically
  const areas = [...new Set(districts.map((d) => d.areaname))].sort()

  return { districts, areas, loading, error }
}

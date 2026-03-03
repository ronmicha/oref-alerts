'use client'

import { useState, useEffect } from 'react'
import { fetchCategories } from '@/lib/oref'
import type { AlertCategory } from '@/types/oref'

export function useCategories() {
  const [categories, setCategories] = useState<AlertCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, error }
}

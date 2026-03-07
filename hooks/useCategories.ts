'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/lib/oref'
import type { AlertCategory } from '@/types/oref'

export function useCategories() {
  const { data: categories = [], isLoading, error } = useQuery<AlertCategory[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  return { categories, loading: isLoading, error: error?.message ?? null }
}

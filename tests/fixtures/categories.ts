import type { AlertCategory } from '@/types/oref'

export const categories: AlertCategory[] = [
  {
    id: 1,
    category: 'missilealert',
    matrix_id: 1,
    priority: 1,
    queue: true,
  },
  {
    id: 2,
    category: 'uav',
    matrix_id: 6,
    priority: 2,
    queue: true,
  },
]

import type { AlertCategory } from '@/types/oref'

// Fixed colors per alert type — consistent across charts, legends, and tooltips
const CATEGORY_COLORS: Record<string, string> = {
  missilealert: '#EF4444', // bright red
  uav:          '#991B1B', // dark red
  flash:        '#F97316', // orange
  update:       '#3B82F6', // blue
}

// Fallback palette for any category not listed above
const FALLBACK_COLORS = ['#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16', '#6B7280']

export function getCategoryColor(categories: AlertCategory[], id: number, fallbackIndex = 0): string {
  const cat = categories.find((c) => c.id === id)
  if (cat && CATEGORY_COLORS[cat.category]) return CATEGORY_COLORS[cat.category]
  return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]
}

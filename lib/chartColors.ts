import type { AlertCategory } from '@/types/oref'

// Fixed colors per alert type — consistent across charts, legends, and tooltips
const CATEGORY_COLORS: Record<string, string> = {
  missilealert: '#E01515', // app accent red — maximum severity (bright)
  uav:          '#7A1010', // dark red — critical, clearly darker than missile
  flash:        '#E07800', // vivid amber — precursor/warning, clearly orange not red
  update:       '#ADA49C', // light warm gray — informational / all clear
}

// Fallback palette for any category not listed above
const FALLBACK_COLORS = ['#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16', '#6B7280']

export function getCategoryColor(categories: AlertCategory[], id: number, fallbackIndex = 0): string {
  const cat = categories.find((c) => c.id === id)
  if (cat && CATEGORY_COLORS[cat.category]) return CATEGORY_COLORS[cat.category]
  return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]
}

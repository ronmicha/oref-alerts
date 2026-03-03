'use client'

import { useI18n } from '@/lib/i18n'
import type { AlertCategory, DateRangeOption } from '@/types/oref'

interface FilterBarProps {
  dateRange: DateRangeOption
  onDateRangeChange: (v: DateRangeOption) => void
  cityLabel: string
  onCityLabelChange: (v: string) => void
  categoryId: number | undefined
  onCategoryIdChange: (v: number | undefined) => void
  cityLabels: string[]
  categories: AlertCategory[]
}

export function FilterBar({
  dateRange, onDateRangeChange,
  cityLabel, onCityLabelChange,
  categoryId, onCategoryIdChange,
  cityLabels, categories,
}: FilterBarProps) {
  const { t, tCategory } = useI18n()

  const selectClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="flex flex-wrap gap-4">
      {/* Date range */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterDateRange')}
        </label>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
          className={selectClass}
        >
          <option value="today">{t('today')}</option>
          <option value="7d">{t('last7days')}</option>
          <option value="14d">{t('last14days')}</option>
          <option value="30d">{t('last30days')}</option>
        </select>
      </div>

      {/* City */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterCity')}
        </label>
        <select
          value={cityLabel}
          onChange={(e) => onCityLabelChange(e.target.value)}
          className={selectClass}
        >
          <option value="">{t('all')}</option>
          {cityLabels.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterCategory')}
        </label>
        <select
          value={categoryId ?? ''}
          onChange={(e) =>
            onCategoryIdChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
          className={selectClass}
        >
          <option value="">{t('all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{tCategory(c.category)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

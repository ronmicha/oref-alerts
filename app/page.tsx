'use client'

import { useState, useMemo } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { FilterBar } from '@/components/FilterBar'
import { AlertChart } from '@/components/AlertChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { filterAlerts, aggregateByDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import type { DateRangeOption } from '@/types/oref'

function getDateRange(option: DateRangeOption): { startDate: string; endDate: string } {
  const today = new Date()
  const end = today.toISOString().slice(0, 10)
  const start = new Date(today)
  if (option === 'today') {
    // no change — start === end === today
  } else if (option === '7d') {
    start.setDate(start.getDate() - 6)
  } else if (option === '14d') {
    start.setDate(start.getDate() - 13)
  } else {
    start.setDate(start.getDate() - 29)
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end }
}

export default function Home() {
  const { t, lang } = useI18n()
  const { alerts, loading: alertsLoading, error: alertsError, retry } = useAlerts()
  const { cityLabels, loading: citiesLoading } = useCities()
  const { categories, loading: categoriesLoading } = useCategories()

  const [dateRange, setDateRange] = useState<DateRangeOption>('7d')
  const [cityLabel, setCityLabel] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)

  const { startDate, endDate } = getDateRange(dateRange)

  const filteredAlerts = useMemo(
    () => filterAlerts(alerts, {
      cityLabel: cityLabel || undefined,
      categoryId,
      startDate,
      endDate,
    }),
    [alerts, cityLabel, categoryId, startDate, endDate]
  )

  const chartData = useMemo(
    () => aggregateByDay(filteredAlerts, startDate, endDate, lang as 'he' | 'en'),
    [filteredAlerts, startDate, endDate, lang]
  )

  const isLoading = alertsLoading || citiesLoading || categoriesLoading

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <h1 className="text-lg font-bold text-gray-900">{t('appTitle')}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <FilterBar
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            cityLabel={cityLabel}
            onCityLabelChange={setCityLabel}
            categoryId={categoryId}
            onCategoryIdChange={setCategoryId}
            cityLabels={cityLabels}
            categories={categories}
          />
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border border-blue-100">
            {t('alertsCount', { count: filteredAlerts.length })}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
            {startDate === endDate ? startDate : `${startDate} – ${endDate}`}
          </span>
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm min-h-[360px] flex items-center justify-center">
          {isLoading && (
            <div className="text-gray-400 text-sm animate-pulse">{t('loading')}</div>
          )}
          {alertsError && !isLoading && (
            <div className="text-center space-y-2">
              <p className="text-red-500 text-sm">{t('errorLoad')}</p>
              <button
                onClick={retry}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                {t('retry')}
              </button>
            </div>
          )}
          {!isLoading && !alertsError && <AlertChart data={chartData} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
        {t('footerSource')}
      </footer>
    </div>
  )
}

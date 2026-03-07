'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useTzevaadomAlerts } from '@/hooks/useTzevaadomAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { FilterBar } from '@/components/FilterBar'
import { AlertChart } from '@/components/AlertChart'
import { TimeOfDayChart } from '@/components/TimeOfDayChart'
import { useAllCitiesAlerts } from '@/hooks/useAllCitiesAlerts'
import { CityRankingChart } from '@/components/CityRankingChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { filterAlerts, aggregateByDay, aggregateByTimeOfDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import type { DateRangeOption } from '@/types/oref'

// Maps UI date range to oref API mode: 1=day, 2=week, 3=month
const API_MODE: Record<Exclude<DateRangeOption, 'custom'>, 1 | 2 | 3> = {
  today: 1,
  '7d':  2,
  '30d': 3,
}

function getPresetDateRange(option: Exclude<DateRangeOption, 'custom'>): { startDate: string; endDate: string } {
  const today = new Date()
  const end = today.toISOString().slice(0, 10)
  const start = new Date(today)
  if (option === '7d') start.setDate(start.getDate() - 6)
  else if (option === '30d') start.setDate(start.getDate() - 29)
  return { startDate: start.toISOString().slice(0, 10), endDate: end }
}

export default function Home() {
  const { t, lang } = useI18n()

  const [dateRange, setDateRange] = useState<DateRangeOption>('7d')
  const [cityLabel, setCityLabel] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const isCustom = dateRange === 'custom'

  // Reset content filters when language changes (city names change; category IDs become stale in context)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setCityLabel('')
    setCategoryId(undefined)
  }, [lang])

  const { alerts: orefAlerts, loading: orefLoading, error: orefError, retry } = useAlerts({
    mode: isCustom ? 1 : API_MODE[dateRange as Exclude<DateRangeOption, 'custom'>],
    city: cityLabel || undefined,
    lang,
    enabled: !isCustom,
  })

  const { alerts: tzevaadomAlerts, loading: tzevaadomLoading, error: tzevaadomError } = useTzevaadomAlerts({
    enabled: isCustom,
  })

  const alerts = isCustom ? tzevaadomAlerts : orefAlerts
  const alertsLoading = isCustom ? tzevaadomLoading : orefLoading
  const alertsError = isCustom ? tzevaadomError : orefError

  const { cityLabels, loading: citiesLoading } = useCities(lang)
  const { categories, loading: categoriesLoading } = useCategories()
  const { cities: rankedCities, loaded: rankLoaded, total: rankTotal, done: rankDone } =
    useAllCitiesAlerts(cityLabels, lang)
  const ALLOWED_CATEGORY_SLUGS = ['missilealert', 'uav', 'flash', 'update']
  const filterableCategories = categories.filter((c) => ALLOWED_CATEGORY_SLUGS.includes(c.category))

  const { startDate, endDate } = useMemo(() => {
    if (isCustom) return { startDate: customFrom, endDate: customTo }
    return getPresetDateRange(dateRange as Exclude<DateRangeOption, 'custom'>)
  }, [isCustom, customFrom, customTo, dateRange])

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
    () => startDate && endDate
      ? aggregateByDay(filteredAlerts, { startDate, endDate, lang: lang as 'he' | 'en' })
      : [],
    [filteredAlerts, startDate, endDate, lang]
  )

  const timeOfDayData = useMemo(
    () => startDate && endDate ? aggregateByTimeOfDay(filteredAlerts) : [],
    [filteredAlerts, startDate, endDate]
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
            categories={filterableCategories}
            customFrom={customFrom}
            onCustomFromChange={setCustomFrom}
            customTo={customTo}
            onCustomToChange={setCustomTo}
          />
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border border-blue-100">
            {t('alertsCount', { count: `${filteredAlerts.length}${filteredAlerts.length === 3000 ? '+' : ''}` })}
          </span>
          {startDate && endDate && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600" dir="ltr">
              {startDate === endDate ? startDate : `${startDate} – ${endDate}`}
            </span>
          )}
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm min-h-[360px]">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('chartByDayTitle')}</h2>
          <div dir="ltr" className="flex items-center justify-center h-full">
          {isLoading && (
            <div className="text-gray-400 text-sm animate-pulse">{t('loading')}</div>
          )}
          {alertsError && !isLoading && (
            <div className="text-center space-y-2">
              <p className="text-red-500 text-sm">{t('errorLoad')}</p>
              {!isCustom && (
                <button
                  onClick={retry}
                  className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  {t('retry')}
                </button>
              )}
            </div>
          )}
          {!isLoading && !alertsError && <AlertChart data={chartData} categories={categories} />}
          </div>
        </div>

        {/* Time-of-day chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm min-h-[320px]">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('chartByTimeTitle')}</h2>
          <div dir="ltr" className="flex items-center justify-center h-full">
          {isLoading && (
            <div className="text-gray-400 text-sm animate-pulse">{t('loading')}</div>
          )}
          {!isLoading && !alertsError && <TimeOfDayChart data={timeOfDayData} categories={categories} />}
          </div>
        </div>

        {/* City ranking chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <CityRankingChart
            cities={rankedCities}
            loaded={rankLoaded}
            total={rankTotal}
            done={rankDone}
            cityLabels={cityLabels}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
        {t('footerSource')}
      </footer>
    </div>
  )
}

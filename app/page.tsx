'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useTzevaadomAlerts } from '@/hooks/useTzevaadomAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { FilterBar } from '@/components/FilterBar'
import { AlertChart } from '@/components/AlertChart'
import { TimeOfDayChart } from '@/components/TimeOfDayChart'
import { useCityRankings } from '@/hooks/useCityRankings'
import { CityRankingChart } from '@/components/CityRankingChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { RefreshCw } from 'lucide-react'
import { filterAlerts, aggregateByDay, aggregateByTimeOfDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import { getPresetDateRange } from '@/lib/dateRange'
import type { DateRangeOption } from '@/types/oref'

// Start of the city ranking window: 28 Feb 2026 00:00:00 Israel time (UTC+2)
const CITY_RANKING_FROM_TS = new Date('2026-02-28T00:00:00+02:00').getTime() / 1000

// Maps UI date range to oref API mode: 1=day, 2=week, 3=month
const API_MODE: Record<Exclude<DateRangeOption, 'custom'>, 1 | 2 | 3> = {
  '24h': 1,
  '7d':  2,
  '30d': 3,
}

export default function Home() {
  const { t, lang } = useI18n()

  const [dateRange, setDateRange] = useState<DateRangeOption>('24h')
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

  // Compute date range first — needed to evaluate isAtLimit correctly
  const { startDate, endDate } = useMemo(() => {
    if (isCustom) return { startDate: customFrom, endDate: customTo }
    return getPresetDateRange(dateRange as Exclude<DateRangeOption, 'custom'>)
  }, [isCustom, customFrom, customTo, dateRange])

  const { alerts: orefAlerts, loading: orefLoading, error: orefError, retry } = useAlerts({
    mode: isCustom ? 1 : API_MODE[dateRange as Exclude<DateRangeOption, 'custom'>],
    city: cityLabel || undefined,
    lang,
    enabled: !isCustom,
  })

  // When oref hits its 3,000-alert cap the data is partial and misleading — fall back to tzevaadom.
  // We compare against the DATE-FILTERED count, not the raw API count, because oref mode=1
  // ("last 24 hours") returns a rolling window that crosses midnight and can hit 3,000 even
  // though only a fraction of those alerts fall within today's calendar date.
  const orefInDateRange = useMemo(
    () => startDate && endDate ? filterAlerts(orefAlerts, { startDate, endDate }) : orefAlerts,
    [orefAlerts, startDate, endDate],
  )
  const isAtLimit = !isCustom && !orefLoading && orefInDateRange.length === 3000
  const useTzevaadom = isCustom || isAtLimit

  const { alerts: tzevaadomAlerts, loading: tzevaadomLoading, error: tzevaadomError, refetch: tzevaadomRefetch } = useTzevaadomAlerts({
    enabled: useTzevaadom,
  })

  const alerts = useTzevaadom ? tzevaadomAlerts : orefAlerts
  const alertsLoading = isCustom ? tzevaadomLoading : isAtLimit ? tzevaadomLoading : orefLoading
  const alertsError = useTzevaadom ? tzevaadomError : orefError

  const { cities, cityLabels, loading: citiesLoading } = useCities(lang)
  const { categories, loading: categoriesLoading } = useCategories()
  const { cities: rankedCities, loading: rankLoading, error: rankError, refetch: rankRefetch } =
    useCityRankings(lang, CITY_RANKING_FROM_TS)
  const ALLOWED_CATEGORY_SLUGS = ['missilealert', 'uav', 'flash', 'update']
  const filterableCategories = categories.filter((c) => ALLOWED_CATEGORY_SLUGS.includes(c.category))

  // Tzevaadom stores Hebrew city names in alert.data. In English mode the user picks an
  // English cityLabel, so we need to map it back to Hebrew before filtering tzevaadom data.
  const enToHe = useMemo(
    () => lang === 'en' ? new Map(cities.map((c) => [c.label, c.label_he])) : null,
    [cities, lang],
  )
  const effectiveCityLabel = useTzevaadom && lang === 'en' && cityLabel && enToHe
    ? (enToHe.get(cityLabel) ?? cityLabel)
    : cityLabel

  const filteredAlerts = useMemo(
    () => filterAlerts(alerts, {
      cityLabel: effectiveCityLabel || undefined,
      categoryId,
      startDate,
      endDate,
    }),
    [alerts, effectiveCityLabel, categoryId, startDate, endDate]
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

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    retry()
    if (useTzevaadom) tzevaadomRefetch()
    rankRefetch()
  }, [retry, tzevaadomRefetch, rankRefetch, useTzevaadom])

  // Clear spinner once all fetches have settled
  useEffect(() => {
    if (isRefreshing && !alertsLoading && !rankLoading) {
      setIsRefreshing(false)
    }
  }, [isRefreshing, alertsLoading, rankLoading])

  const cardStyle = {
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
  } as React.CSSProperties

  const sectionHeadingStyle = {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
    marginBottom: '0.875rem',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sticky header + accent bar */}
      <div className="sticky top-0 z-40">
      <div style={{ height: 3, background: 'var(--color-accent)' }} />
      <header style={{ background: 'var(--color-header)' }}>
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
            </svg>
            <h1 style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
              {t('appTitle')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh data"
              style={{
                width: 'calc(1.8rem + 2px)',
                height: 'calc(1.8rem + 2px)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.22)',
                color: 'rgba(255,255,255,0.82)',
                background: 'transparent',
                cursor: isRefreshing ? 'default' : 'pointer',
                opacity: isRefreshing ? 0.6 : 1,
              }}
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <LanguageToggle />
          </div>
        </div>
      </header>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Filters */}
        <div style={{ ...cardStyle, padding: '1.25rem 1.5rem' }}>
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

        {/* Summary bar */}
        <div className="flex items-center gap-3 px-1">
          <div
            className="flex items-baseline gap-1.5"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 8,
              padding: '0.3rem 0.875rem',
            }}
          >
            <span style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1 }}>
              {filteredAlerts.length}{filteredAlerts.length === 3000 ? '+' : ''}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {t('total')}
            </span>
          </div>
          {startDate && endDate && (
            <span
              dir="ltr"
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
                fontWeight: 500,
              }}
            >
              {startDate === endDate ? startDate : `${startDate} – ${endDate}`}
            </span>
          )}
        </div>

        {/* Alerts by Day */}
        <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', height: 360 }}>
          <p style={sectionHeadingStyle}>{t('chartByDayTitle')}</p>
          <div dir="ltr" className="flex items-center justify-center">
            {isLoading && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '4rem 0' }}>
                {t('loading')}
              </div>
            )}
            {alertsError && !isLoading && (
              <div className="text-center space-y-3" style={{ padding: '3rem 0' }}>
                <p style={{ color: 'var(--color-accent)', fontSize: '0.875rem' }}>{t('errorLoad')}</p>
                {!isCustom && (
                  <button
                    onClick={retry}
                    style={{
                      padding: '0.4rem 1.25rem',
                      borderRadius: 7,
                      background: 'var(--color-accent)',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t('retry')}
                  </button>
                )}
              </div>
            )}
            {!isLoading && !alertsError && <AlertChart data={chartData} categories={categories} />}
          </div>
        </div>

        {/* Alerts by Time of Day */}
        <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', height: 775 }}>
          <p style={sectionHeadingStyle}>{t('chartByTimeTitle')}</p>
          <div dir="ltr" className="flex items-center justify-center">
            {isLoading && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '4rem 0' }}>
                {t('loading')}
              </div>
            )}
            {!isLoading && !alertsError && <TimeOfDayChart data={timeOfDayData} categories={categories} />}
          </div>
        </div>

        {/* City Rankings */}
        <div style={{ ...cardStyle, padding: '1.25rem 1.5rem' }}>
          <CityRankingChart
            cities={rankedCities}
            loading={rankLoading}
            error={rankError}
            fromTs={CITY_RANKING_FROM_TS}
            cityLabels={cityLabels}
          />
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--color-border)', marginTop: '1.5rem' }}>
        <div
          className="max-w-4xl mx-auto px-5 py-4 text-center"
          style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}
        >
          {t('footerSource')}
        </div>
      </footer>
    </div>
  )
}

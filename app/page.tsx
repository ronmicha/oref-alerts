'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAlerts } from '@/hooks/useAlerts'
import { useTzevaadomAlerts } from '@/hooks/useTzevaadomAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { FilterBar } from '@/components/FilterBar'
import { ByDayChart } from '@/components/ByDayChart'
import { TimeOfDayChart } from '@/components/TimeOfDayChart'
import { useCityRankings } from '@/hooks/useCityRankings'
import { CityRankingChart } from '@/components/CityRankingChart'
import { LanguageToggle } from '@/components/LanguageToggle'
import { DonateFAB } from '@/components/DonateFAB'
import { MapView } from '@/components/MapView'
import { RefreshCw, Loader2 } from 'lucide-react'
import { filterAlerts, aggregateByDay, aggregateByTimeOfDay } from '@/lib/filter'
import { useI18n } from '@/lib/i18n'
import { getPresetDateRange } from '@/lib/dateRange'
import { TAB_BAR_HEIGHT } from '@/lib/layout'
import type { DateRangeOption } from '@/types/oref'

// Maps UI date range to oref API mode: 1=day, 2=week, 3=month
const API_MODE: Record<Exclude<DateRangeOption, 'custom'>, 1 | 2 | 3> = {
  '24h': 1,
  '7d':  2,
  '30d': 3,
}

function formatDate(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.slice(0, 10).split('-')
  return `${dd}/${mm}/${yyyy}`
}


export default function Home() {
  const { t, lang } = useI18n()

  const [activeTab, setActiveTab] = useState<'charts' | 'map'>('charts')

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
  const { rankFromTs, rankToTs } = useMemo(() => {
    const fromStr = startDate ? (startDate.includes('T') ? startDate : startDate + 'T00:00') : null
    const toStr = endDate ? (endDate.includes('T') ? endDate : endDate + 'T23:59:59') : null
    return {
      rankFromTs: fromStr ? new Date(fromStr).getTime() / 1000 : 0,
      rankToTs: toStr ? new Date(toStr).getTime() / 1000 : Date.now() / 1000,
    }
  }, [startDate, endDate])

  const { cities: rankedCities, loading: rankLoading, error: rankError, refetch: rankRefetch } =
    useCityRankings(lang, rankFromTs, rankToTs)
  const ALLOWED_CATEGORY_SLUGS = ['missilealert', 'uav', 'flash', 'update']
  const filterableCategories = categories.filter((c) => ALLOWED_CATEGORY_SLUGS.includes(c.category))

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

  const chartRangeLabel = useMemo(() => {
    if (isCustom) {
      return startDate && endDate
        ? `${formatDate(startDate)} – ${formatDate(endDate)}`
        : ''
    }
    const map: Record<string, string> = {
      '24h': t('24h'),
      '7d': t('last7days'),
      '30d': t('last30days'),
    }
    return map[dateRange] ?? ''
  }, [isCustom, startDate, endDate, dateRange, t])

  const chartSubtitle = useMemo(() => {
    const cityPart = cityLabel || t('allCities')
    return chartRangeLabel ? `${chartRangeLabel} · ${cityPart}` : ''
  }, [chartRangeLabel, cityLabel, t])

  const isLoading = alertsLoading || citiesLoading || categoriesLoading

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    retry()
    if (useTzevaadom) tzevaadomRefetch()
    rankRefetch()
  }, [retry, tzevaadomRefetch, rankRefetch, useTzevaadom])

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
      {/* ── CHARTS TAB ── */}
      {activeTab === 'charts' && (
        <>
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

          <main
            className="max-w-4xl mx-auto px-4 py-5 space-y-4"
            style={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
          >
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
                <span data-testid="alert-count" style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1 }}>
                  {filteredAlerts.length.toLocaleString()}{filteredAlerts.length === 3000 ? '+' : ''}
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
                  {startDate.slice(0, 10) === endDate.slice(0, 10)
                    ? formatDate(startDate)
                    : `${formatDate(startDate)} – ${formatDate(endDate)}`}
                </span>
              )}
            </div>

            {/* Alerts by Day */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', height: 360 }}>
              <p style={{ ...sectionHeadingStyle, marginBottom: chartSubtitle ? '0.1rem' : sectionHeadingStyle.marginBottom }}>{t('chartByDayTitle')}</p>
              {chartSubtitle && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', opacity: 0.75 }}>{chartSubtitle}</p>
              )}
              <div dir="ltr" className="flex items-center justify-center">
                {isLoading && (
                  <div dir="auto" style={{ color: 'var(--color-text-muted)', padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                    <Loader2 size={22} className="animate-spin" style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, opacity: 0.5 }}>{t('loading')}</span>
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
                {!isLoading && !alertsError && <ByDayChart data={chartData} categories={categories} />}
              </div>
            </div>

            {/* Alerts by Time of Day */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', height: 775 }}>
              <p style={{ ...sectionHeadingStyle, marginBottom: chartSubtitle ? '0.1rem' : sectionHeadingStyle.marginBottom }}>{t('chartByTimeTitle')}</p>
              {chartSubtitle && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', opacity: 0.75 }}>{chartSubtitle}</p>
              )}
              <div dir="ltr" className="flex items-center justify-center">
                {isLoading && (
                  <div dir="auto" style={{ color: 'var(--color-text-muted)', padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                    <Loader2 size={22} className="animate-spin" style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, opacity: 0.5 }}>{t('loading')}</span>
                  </div>
                )}
                {!isLoading && !alertsError && <TimeOfDayChart data={timeOfDayData} categories={categories} showNowLabels={dateRange === '24h'} />}
              </div>
            </div>

            {/* City Rankings */}
            <div style={{ ...cardStyle, padding: '1.25rem 1.5rem' }}>
              <CityRankingChart
                cities={rankedCities}
                loading={rankLoading}
                error={rankError}
                subtitle={chartRangeLabel}
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
              <br />
              {t('footerDeveloper')}{' '}
              <a
                href="https://www.linkedin.com/in/ron-michaeli-a60798115"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {t('developerName')}
              </a>
            </div>
          </footer>
        </>
      )}

      {activeTab === 'map' && <MapView />}

      {/* ── BOTTOM TAB BAR ── */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_BAR_HEIGHT,
          background: '#111111',
          borderTop: '2px solid var(--color-accent)',
          display: 'flex',
          zIndex: 50,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {(['charts', 'map'] as const).map((tab) => {
          const label = tab === 'charts' ? t('tabCharts') : t('tabMap')
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                border: 'none',
                background: isActive ? 'rgba(204,18,18,0.15)' : 'transparent',
                cursor: 'pointer',
                color: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.75)',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.05em',
                transition: 'background 0.15s, color 0.15s',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon */}
              {tab === 'charts' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
              )}
              {label}
            </button>
          )
        })}
      </nav>

      {/* DonateFAB is always visible on both tabs */}
      <DonateFAB />
    </div>
  )
}

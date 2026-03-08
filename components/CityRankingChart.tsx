'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer,
} from 'recharts'
import type { CityCount } from '@/types/oref'
import { CityCombobox } from '@/components/FilterBar'
import { useI18n } from '@/lib/i18n'

interface CityRankingChartProps {
  cities: CityCount[]
  loading: boolean
  error: string | null
  fromTs: number
  cityLabels: string[]
}

const LIMIT = 50

function formatDateShort(ts: number, lang: 'he' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: 'numeric',
    month: 'short',
  }).format(new Date(ts * 1000))
}

export function CityRankingChart({ cities, loading, error, fromTs, cityLabels }: CityRankingChartProps) {
  const { t, lang } = useI18n()
  const [sortDesc, setSortDesc] = useState(true)
  const [cityLabel, setCityLabel] = useState('')

  const withAlerts = cities.filter((c) => c.count > 0)

  // Rank is always based on most-alerts-first order (#1 = most alerts)
  const rankMap = useMemo(
    () => new Map([...withAlerts].sort((a, b) => b.count - a.count).map((city, i) => [city.label, i + 1])),
    [withAlerts],
  )

  const sortedSliced = cityLabel
    ? (() => {
        const found = withAlerts.filter((c) => c.label === cityLabel)
        return found.length > 0 ? found : [{ label: cityLabel, count: 0 }]
      })()
    : [...withAlerts].sort((a, b) => sortDesc ? b.count - a.count : a.count - b.count).slice(0, LIMIT)

  const displayData = sortedSliced.map((city) => ({
    ...city,
    displayLabel: city.count === 0 ? `#—  ${city.label}` : `#${rankMap.get(city.label) ?? '?'}  ${city.label}`,
  }))

  const chartHeight = Math.max(200, displayData.length * 22 + 60)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            {t('chartByCityTitle', {
              from: formatDateShort(fromTs, lang as 'he' | 'en'),
              to: formatDateShort(Date.now() / 1000, lang as 'he' | 'en'),
            })}
          </h2>
          {!loading && !cityLabel && withAlerts.length > LIMIT && (
            <p className="text-xs text-gray-400 mt-0.5">
              {sortDesc
                ? t('cityRankingTop', { n: String(LIMIT), total: String(withAlerts.length) })
                : t('cityRankingBottom', { n: String(LIMIT), total: String(withAlerts.length) })}
            </p>
          )}
          {!loading && cityLabel && (
            <p className="text-xs text-gray-400 mt-0.5">
              {rankMap.has(cityLabel)
                ? t('cityRankSearchInfo', { rank: String(rankMap.get(cityLabel)), total: String(withAlerts.length) })
                : t('cityRankingNoAlerts')}
            </p>
          )}
        </div>
        {!cityLabel && (
          <button
            onClick={() => setSortDesc((d) => !d)}
            disabled={loading || withAlerts.length === 0}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sortDesc ? t('sortLeastFirst') : t('sortMostFirst')}
          </button>
        )}
      </div>

      {/* City search */}
      <div className="mb-3">
        <CityCombobox
          value={cityLabel}
          onChange={setCityLabel}
          options={cityLabels}
          placeholder={t('filterCity')}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-sm text-gray-400 text-center py-8 animate-pulse">{t('loading')}</div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-sm text-red-500 text-center py-8">{t('errorLoad')}</div>
      )}

      {/* Empty state */}
      {!loading && !error && displayData.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">{t('cityRankingEmpty')}</div>
      )}

      {/* Chart */}
      {!loading && !error && displayData.length > 0 && (
        <div dir="ltr" style={{ maxHeight: 600, overflowY: 'auto' }}>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayData}
                layout="vertical"
                margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                />
                <YAxis
                  type="category"
                  dataKey="displayLabel"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  width={200}
                />
                <Bar
                  dataKey="count"
                  fill="#EF4444"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={16}
                  isAnimationActive={true}
                  animationDuration={400}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    style={{ fontSize: 11, fill: '#6B7280' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

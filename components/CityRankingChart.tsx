'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer,
} from 'recharts'
import type { CityCount } from '@/hooks/useAllCitiesAlerts'
import { useI18n } from '@/lib/i18n'

interface CityRankingChartProps {
  cities: CityCount[]
  loaded: number
  total: number
  done: boolean
  cityLabel?: string
}

const LIMIT = 50

export function CityRankingChart({ cities, loaded, total, done, cityLabel }: CityRankingChartProps) {
  const { t } = useI18n()
  const [sortDesc, setSortDesc] = useState(true)

  const withAlerts = cities.filter((c) => c.count > 0)

  // If a city is selected: show just that city (no limit, no rank)
  // Otherwise: sort by count, cap to LIMIT, prepend rank number
  const sortedSliced = cityLabel
    ? withAlerts.filter((c) => c.label === cityLabel)
    : [...withAlerts].sort((a, b) => sortDesc ? b.count - a.count : a.count - b.count).slice(0, LIMIT)

  const displayData = sortedSliced.map((city, i) => ({
    ...city,
    displayLabel: cityLabel ? city.label : `#${i + 1}  ${city.label}`,
  }))

  const chartHeight = Math.max(200, displayData.length * 22 + 60)
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">{t('chartByCityTitle')}</h2>
          {done && !cityLabel && withAlerts.length > LIMIT && (
            <p className="text-xs text-gray-400 mt-0.5">
              {sortDesc
                ? t('cityRankingTop', { n: String(LIMIT), total: String(withAlerts.length) })
                : t('cityRankingBottom', { n: String(LIMIT), total: String(withAlerts.length) })}
            </p>
          )}
        </div>
        {!cityLabel && (
          <button
            onClick={() => setSortDesc((d) => !d)}
            disabled={!done || withAlerts.length === 0}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sortDesc ? t('sortLeastFirst') : t('sortMostFirst')}
          </button>
        )}
      </div>

      {/* Loading progress — only while fetching, with percentage bar */}
      {!done && total > 0 && (
        <div className="mb-3 text-xs text-blue-600 bg-blue-50 rounded px-3 py-2">
          {t('cityRankingLoading', { pct: String(pct) })}
          <div className="mt-1.5 h-1 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Chart — only shown when done */}
      {done && displayData.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">{t('cityRankingEmpty')}</div>
      )}

      {done && displayData.length > 0 && (
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

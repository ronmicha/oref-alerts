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
}

export function CityRankingChart({ cities, loaded, total, done }: CityRankingChartProps) {
  const { t } = useI18n()
  const [sortDesc, setSortDesc] = useState(true)

  const withAlerts = cities.filter((c) => c.count > 0)

  // While loading: keep insertion order so bars don't jump and blink.
  // Once done: apply the user's sort preference; Recharts animates the value changes.
  const displayData = done
    ? [...withAlerts].sort((a, b) => sortDesc ? b.count - a.count : a.count - b.count)
    : withAlerts

  // 22px per bar row + margins
  const chartHeight = Math.max(200, displayData.length * 22 + 60)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{t('chartByCityTitle')}</h2>
        <button
          onClick={() => setSortDesc((d) => !d)}
          disabled={!done || withAlerts.length === 0}
          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sortDesc ? t('sortLeastFirst') : t('sortMostFirst')}
        </button>
      </div>

      {/* Loading progress banner */}
      {!done && total > 0 && (
        <div className="mb-3 text-xs text-blue-600 bg-blue-50 rounded px-3 py-2 animate-pulse">
          {t('cityRankingLoading', { loaded, total })}
        </div>
      )}

      {/* Empty state once done */}
      {done && displayData.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">{t('cityRankingEmpty')}</div>
      )}

      {/* Scrollable chart */}
      {displayData.length > 0 && (
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
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  width={180}
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

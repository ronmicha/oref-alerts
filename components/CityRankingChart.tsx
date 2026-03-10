'use client'

import { useMemo, useState } from 'react'
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
    : [...withAlerts].sort((a, b) => {
        const countDiff = sortDesc ? b.count - a.count : a.count - b.count
        if (countDiff !== 0) return countDiff
        // For ties in "least first", higher rank number (worse) comes first
        if (!sortDesc) return (rankMap.get(b.label) ?? 0) - (rankMap.get(a.label) ?? 0)
        return 0
      }).slice(0, 50)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            {t('chartByCityTitle', { from: formatDateShort(fromTs, lang as 'he' | 'en') })}
          </h2>
          {!loading && !cityLabel && withAlerts.length > 50 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {sortDesc
                ? t('cityRankingTop', { n: '50', total: String(withAlerts.length) })
                : t('cityRankingBottom', { n: '50', total: String(withAlerts.length) })}
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
      {!loading && !error && sortedSliced.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">{t('cityRankingEmpty')}</div>
      )}

      {/* Table */}
      {!loading && !error && sortedSliced.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-500 w-14">{t('rankColumn')}</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">{t('filterCity')}</th>
                <th className="text-right py-2 px-3 font-medium text-gray-500 w-20">{t('alertsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedSliced.map((city, i) => {
                const rank = rankMap.get(city.label)
                return (
                  <tr key={city.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-2 px-3 text-gray-400 tabular-nums">
                      {city.count === 0 ? '—' : `#${rank}`}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{city.label}</td>
                    <td className="py-2 px-3 text-right text-gray-700 font-medium tabular-nums">
                      {city.count === 0 ? '—' : city.count}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

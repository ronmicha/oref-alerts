'use client'

import { useMemo, useState } from 'react'
import type { CityCount } from '@/types/oref'
import { CityCombobox } from '@/components/FilterBar'
import { useI18n } from '@/lib/i18n'

interface CityRankingChartProps {
  cities: CityCount[]
  loading: boolean
  error: string | null
  subtitle: string
  cityLabels: string[]
}

export function CityRankingChart({ cities, loading, error, subtitle, cityLabels }: CityRankingChartProps) {
  const { t } = useI18n()
  const [sortDesc, setSortDesc] = useState(true)
  const [selectedCities, setSelectedCities] = useState<string[]>([])

  const addCity = (label: string) => {
    if (label && !selectedCities.includes(label)) {
      setSelectedCities((prev) => [...prev, label])
    }
  }
  const removeCity = (label: string) => {
    setSelectedCities((prev) => prev.filter((c) => c !== label))
  }

  const withAlerts = cities.filter((c) => c.count > 0)

  // Rank is always based on most-alerts-first order (#1 = most alerts)
  const rankMap = useMemo(
    () => new Map([...withAlerts].sort((a, b) => b.count - a.count).map((city, i) => [city.label, i + 1])),
    [withAlerts],
  )

  const sortedSliced = selectedCities.length > 0
    ? selectedCities
        .map((label) => withAlerts.find((c) => c.label === label) ?? { label, count: 0 })
        .sort((a, b) => b.count - a.count)
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
      <div className="mb-3">
        <p style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: '0.1rem',
        }}>
          {t('chartByCityTitle')}
        </p>
        {(() => {
          const rankPart = !loading && selectedCities.length === 0 && withAlerts.length > 50
            ? (sortDesc
                ? t('cityRankingTop', { n: '50', total: withAlerts.length.toLocaleString() })
                : t('cityRankingBottom', { n: '50', total: withAlerts.length.toLocaleString() }))
            : ''
          const full = [subtitle, rankPart].filter(Boolean).join(' · ')
          return full ? (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', opacity: 0.75 }}>{full}</p>
          ) : null
        })()}
      </div>

      {/* City search */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('compareSearchLabel')}
        </label>
        <CityCombobox
          value=""
          onChange={addCity}
          options={cityLabels.filter((l) => !selectedCities.includes(l))}
          placeholder={t('all')}
        />
      </div>
      {selectedCities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
          {selectedCities.map((label) => (
            <span
              key={label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              {label}
              <button
                onClick={() => removeCity(label)}
                aria-label={`Remove ${label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1,
                  fontSize: '0.85rem',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
          {t('loading')}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ color: 'var(--color-accent)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
          {t('errorLoad')}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sortedSliced.length === 0 && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
          {t('cityRankingEmpty')}
        </div>
      )}

      {/* Table */}
      {!loading && !error && sortedSliced.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th className="text-start py-2 px-3 w-14" style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{t('rankColumn')}</th>
                <th className="text-start py-2 px-3" style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{t('filterCity')}</th>
                <th className="text-end py-2 px-3 w-20" style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                  {selectedCities.length === 0 ? (
                    <button
                      onClick={() => setSortDesc((d) => !d)}
                      disabled={loading || withAlerts.length === 0}
                      className="inline-flex items-center gap-1 ms-auto"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: withAlerts.length === 0 ? 'default' : 'pointer',
                        font: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        letterSpacing: 'inherit',
                        textTransform: 'inherit',
                        color: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {t('alertsColumn')}
                      <svg
                        width="10" height="12" viewBox="0 0 10 12" fill="none"
                        aria-hidden="true"
                        style={{ flexShrink: 0, opacity: withAlerts.length === 0 ? 0.35 : 1 }}
                      >
                        <path d="M5 1 L8.5 5 H1.5 Z" fill={sortDesc ? 'var(--color-text-muted)' : 'var(--color-accent)'} />
                        <path d="M5 11 L1.5 7 H8.5 Z" fill={sortDesc ? 'var(--color-accent)' : 'var(--color-text-muted)'} />
                      </svg>
                    </button>
                  ) : t('alertsColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSliced.map((city, i) => {
                const rank = rankMap.get(city.label)
                return (
                  <tr
                    key={city.label}
                    style={{ background: i % 2 === 0 ? 'var(--color-card)' : 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                      {city.count === 0 ? '—' : `#${rank}`}
                    </td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text)', fontWeight: 500 }}>{city.label}</td>
                    <td className="py-2 px-3 text-end tabular-nums" style={{ color: city.count > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: 700 }}>
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

'use client'

import 'leaflet/dist/leaflet.css'

import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { fetchTzevaadomRaw, TZEVAADOM_ALLOWED_CODES, normalizeTzevaadomCity } from '@/lib/tzevaadom'
import { getCityCoords } from '@/lib/citiesGeo'
import { getPresetDateRange } from '@/lib/dateRange'
import { useI18n } from '@/lib/i18n'
import type { DateRangeOption } from '@/types/oref'

// ── Color interpolation ──────────────────────────────────────────────────────

/** Linear interpolation between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Returns a color interpolated across green → yellow → red.
 * ratio 0.0 → #22c55e (green)
 * ratio 0.5 → #eab308 (yellow)
 * ratio 1.0 → #E01515 (red)
 */
export function interpolateColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio))

  let red: number, green: number, blue: number

  if (r < 0.5) {
    // green → yellow
    const t = r * 2
    red   = Math.round(lerp(0x22, 0xea, t))
    green = Math.round(lerp(0xc5, 0xb3, t))
    blue  = Math.round(lerp(0x5e, 0x08, t))
  } else {
    // yellow → red
    const t = (r - 0.5) * 2
    red   = Math.round(lerp(0xea, 0xe0, t))
    green = Math.round(lerp(0xb3, 0x15, t))
    blue  = Math.round(lerp(0x08, 0x15, t))
  }

  return `rgb(${red},${green},${blue})`
}

// ── Radius scale ─────────────────────────────────────────────────────────────

const RADIUS_MIN = 4
const RADIUS_MAX = 18

function scaleRadius(count: number, maxCount: number): number {
  if (maxCount === 0) return RADIUS_MIN
  const ratio = count / maxCount
  return RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * ratio
}

// ── MapResizer ────────────────────────────────────────────────────────────────

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

// ── Main component ────────────────────────────────────────────────────────────

interface CityCount {
  cityName: string
  count: number
  lat: number
  lng: number
}

export function HistoryMap() {
  const { t } = useI18n()
  const [dateRange, setDateRange] = useState<DateRangeOption>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const isCustom = dateRange === 'custom'

  const { startDate, endDate } = useMemo(() => {
    if (isCustom) return { startDate: customFrom, endDate: customTo }
    return getPresetDateRange(dateRange as Exclude<DateRangeOption, 'custom'>)
  }, [isCustom, customFrom, customTo, dateRange])

  const startTs = useMemo(
    () => startDate ? new Date(startDate.includes('T') ? startDate : startDate + 'T00:00').getTime() / 1000 : 0,
    [startDate],
  )
  const endTs = useMemo(
    () => endDate ? new Date(endDate.includes('T') ? endDate : endDate + 'T23:59:59').getTime() / 1000 : Date.now() / 1000,
    [endDate],
  )

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['tzevaadomRaw'],
    queryFn: fetchTzevaadomRaw,
    staleTime: 30 * 60 * 1000,
  })

  const cityCounts = useMemo<CityCount[]>(() => {
    if (!raw) return []
    const counts = new Map<string, number>()
    for (const [, code, cityArr, ts] of raw) {
      if (!TZEVAADOM_ALLOWED_CODES.has(code)) continue
      if (ts < startTs || ts > endTs) continue
      for (const rawCity of cityArr) {
        const city = normalizeTzevaadomCity(rawCity)
        counts.set(city, (counts.get(city) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .filter(([cityName]) => getCityCoords(cityName) !== null)
      .map(([cityName, count]) => {
        const coords = getCityCoords(cityName)!
        return { cityName, count, lat: coords.lat, lng: coords.lng }
      })
  }, [raw, startTs, endTs])

  const maxCount = useMemo(
    () => cityCounts.reduce((m, c) => Math.max(m, c.count), 0),
    [cityCounts],
  )

  const selectClass =
    'rounded-lg border bg-white ps-3 pe-3 py-1.5 text-sm focus:outline-none focus:ring-1 appearance-none' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]'

  const dateInputClass =
    'rounded-lg border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Date range selector — floated above map */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 10,
          padding: '8px 14px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(6px)',
        }}
      >
        <select
          value={isCustom ? 'custom' : dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
          className={selectClass}
        >
          <option value="24h">{t('24h')}</option>
          <option value="7d">{t('last7days')}</option>
          <option value="30d">{t('last30days')}</option>
          <option value="custom">{t('custom')}</option>
        </select>

        {isCustom && (
          <>
            <input
              type="date"
              dir="ltr"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={dateInputClass}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>–</span>
            <input
              type="date"
              dir="ltr"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={dateInputClass}
            />
          </>
        )}
      </div>

      <MapContainer
        center={[31.5, 34.8]}
        zoom={8}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />

        {cityCounts.map(({ cityName, count, lat, lng }) => {
          const ratio = maxCount > 0 ? count / maxCount : 0
          const color = interpolateColor(ratio)
          const radius = scaleRadius(count, maxCount)
          return (
            <CircleMarker
              key={cityName}
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                color: color,
                fillOpacity: 0.75,
                weight: 1,
              }}
            />
          )
        })}
      </MapContainer>

      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(242,241,238,0.7)',
            zIndex: 999,
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          {t('loading')}
        </div>
      )}

      {/* Error overlay */}
      {error && !isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.78rem',
            fontWeight: 600,
            zIndex: 1000,
          }}
        >
          {t('errorLoad')}
        </div>
      )}
    </div>
  )
}

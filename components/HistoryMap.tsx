'use client'

import 'leaflet/dist/leaflet.css'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { fetchTzevaadomRaw, TZEVAADOM_ALLOWED_CODES, normalizeTzevaadomCity } from '@/lib/tzevaadom'
import { getCityEntry } from '@/lib/citiesGeo'
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

// ── Category mapping ─────────────────────────────────────────────────────────

// Maps tzevaadom code → oref category ID
const TZEVAADOM_CODE_TO_OREF_CATEGORY: Record<number, number> = { 0: 1, 5: 2 }
// Maps oref category ID → translation slug
const CATEGORY_ID_TO_SLUG: Record<number, string> = { 1: 'missilealert', 2: 'uav' }

// ── MapResizer ────────────────────────────────────────────────────────────────

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

// ── Map state tracker ────────────────────────────────────────────────────────

interface MapBounds {
  north: number; south: number; east: number; west: number
}
interface MapViewState { zoom: number; bounds: MapBounds }

function MapStateTracker({ onChange }: { onChange: (s: MapViewState) => void }) {
  const map = useMapEvents({
    zoom: () => sync(),
    moveend: () => sync(),
  })

  function sync() {
    const b = map.getBounds()
    onChange({
      zoom: map.getZoom(),
      bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
    })
  }

  // Initialise on mount so labels are correct before any interaction
  useEffect(() => { sync() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/** How many top cities (within the viewport) get a label at a given zoom level. */
function labelCountForZoom(zoom: number): number {
  if (zoom <= 7) return 10
  if (zoom === 8) return 15
  if (zoom === 9) return 25
  return 40
}

// ── Main component ────────────────────────────────────────────────────────────

interface CityCount {
  cityName: string
  label_en: string
  count: number
  countByCategory: Map<number, number>
  lat: number
  lng: number
}

export function HistoryMap() {
  const { t, tCategory, lang } = useI18n()
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d')
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
    const counts = new Map<string, { total: number; byCategory: Map<number, number> }>()
    for (const [, code, cityArr, ts] of raw) {
      if (!TZEVAADOM_ALLOWED_CODES.has(code)) continue
      if (ts < startTs || ts > endTs) continue
      const catId = TZEVAADOM_CODE_TO_OREF_CATEGORY[code]
      for (const rawCity of cityArr) {
        const city = normalizeTzevaadomCity(rawCity)
        const existing = counts.get(city)
        if (existing) {
          existing.total++
          existing.byCategory.set(catId, (existing.byCategory.get(catId) ?? 0) + 1)
        } else {
          counts.set(city, { total: 1, byCategory: new Map([[catId, 1]]) })
        }
      }
    }
    return Array.from(counts.entries())
      .filter(([cityName]) => getCityEntry(cityName) !== null)
      .map(([cityName, { total, byCategory }]) => {
        const entry = getCityEntry(cityName)!
        return { cityName, label_en: entry.label_en, count: total, countByCategory: byCategory, lat: entry.lat, lng: entry.lng }
      })
  }, [raw, startTs, endTs])

  const maxCount = useMemo(
    () => cityCounts.reduce((m, c) => Math.max(m, c.count), 0),
    [cityCounts],
  )

  const [mapState, setMapState] = useState<MapViewState>({ zoom: 8, bounds: null as unknown as MapBounds })
  const handleMapState = useCallback((s: MapViewState) => setMapState(s), [])

  const labeledCityNames = useMemo(() => {
    const { zoom, bounds } = mapState
    const visible = bounds
      ? cityCounts.filter(c =>
          c.lat >= bounds.south && c.lat <= bounds.north &&
          c.lng >= bounds.west  && c.lng <= bounds.east
        )
      : cityCounts
    const limit = labelCountForZoom(zoom)
    return new Set(visible.slice(0, limit).map((c) => c.cityName))
  }, [cityCounts, mapState])

  const selectClass =
    'rounded-lg border bg-white ps-3 pe-3 py-1 focus:outline-none focus:ring-1 appearance-none' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]' +
    ' text-[0.78rem]'

  const dateInputClass =
    'rounded-lg border bg-white px-3 py-1 focus:outline-none focus:ring-1' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]' +
    ' text-[0.78rem]'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Date range selector — floated above map */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 10,
          padding: '4px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(6px)',
        }}
      >
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={isCustom ? 'custom' : dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
            className={selectClass}
            style={{ paddingInlineEnd: '1.4rem' }}
          >
            <option value="24h">{t('24h')}</option>
            <option value="7d">{t('last7days')}</option>
            <option value="30d">{t('last30days')}</option>
            <option value="custom">{t('custom')}</option>
          </select>
          <svg
            viewBox="0 0 10 6"
            width="10"
            height="10"
            style={{ position: 'absolute', insetInlineEnd: '0.4rem', pointerEvents: 'none', color: 'var(--color-text-muted)' }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </div>

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
        <MapStateTracker onChange={handleMapState} />

        {cityCounts.map(({ cityName, label_en, count, countByCategory, lat, lng }) => {
          const ratio = maxCount > 0 ? count / maxCount : 0
          const color = interpolateColor(ratio)
          const radius = scaleRadius(count, maxCount)
          const displayName = lang === 'en' ? label_en : cityName
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
            >
              {labeledCityNames.has(cityName) && (
                <Tooltip permanent direction="top" className="city-label">
                  {displayName}
                </Tooltip>
              )}
              <Popup closeButton={false}>
                <div dir={lang === 'he' ? 'rtl' : 'ltr'} style={lang === 'he' ? { textAlign: 'right' } : undefined}>
                  <strong style={{ fontSize: '0.9rem' }}>{displayName}</strong>
                  <div style={{ marginTop: 4, fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Array.from(countByCategory.entries())
                      .sort(([a], [b]) => a - b)
                      .map(([catId, catCount]) => (
                        <div key={catId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: '#555' }}>{tCategory(CATEGORY_ID_TO_SLUG[catId] ?? String(catId))}</span>
                          <span style={{ fontWeight: 600 }}>{catCount.toLocaleString()}</span>
                        </div>
                      ))}
                    <div style={{ borderTop: '1px solid #eee', marginTop: 2, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{t('total')}</span>
                      <span style={{ color: '#CC1212' }}>{count.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Color scale legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          right: 8,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.5)',
          borderRadius: 8,
          padding: '8px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'stretch',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.7rem', color: '#444', textAlign: 'right' }}>
          <span>{maxCount.toLocaleString()}</span>
          <span>0</span>
        </div>
        <div
          style={{
            width: 12,
            height: 72,
            borderRadius: 6,
            background: 'linear-gradient(to bottom, #E01515, #eab308, #22c55e)',
            flexShrink: 0,
          }}
        />
      </div>

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
            zIndex: 1001,
          }}
        >
          {t('errorLoad')}
        </div>
      )}
    </div>
  )
}

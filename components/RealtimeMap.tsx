'use client'

// Leaflet CSS must be imported inside the dynamically-loaded component, not at the app root.
// Because this file is only ever loaded via next/dynamic({ ssr: false }), the import
// executes only on the client, avoiding SSR crashes.
import 'leaflet/dist/leaflet.css'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts'
import { getCityCoords } from '@/lib/citiesGeo'
import { useI18n } from '@/lib/i18n'

// Oref category IDs — must stay in sync with oref API
// These values are confirmed via GET /api/categories and lib/chartColors.ts
const CATEGORY_MISSILE = 1   // missilealert
const CATEGORY_UAV = 2       // uav
const CATEGORY_FLASH = 14    // flash

// Colors verified against lib/chartColors.ts CATEGORY_COLORS:
//   missilealert: '#E01515'
//   uav:          '#7A1010'
//   flash:        '#E07800'
const COLOR_MISSILE = '#E01515'
const COLOR_UAV = '#7A1010'
const COLOR_FLASH = '#E07800'

// Circle sizes
const RADIUS_SINGLE = 8
const RADIUS_OUTER = 12   // UAV outer ring when co-occurring with missile
const RADIUS_INNER = 7    // Missile inner fill when co-occurring with UAV

const CATEGORY_SLUGS: Record<number, string> = {
  [CATEGORY_MISSILE]: 'missilealert',
  [CATEGORY_UAV]: 'uav',
  [CATEGORY_FLASH]: 'flash',
}

const CATEGORY_COLORS: Record<number, string> = {
  [CATEGORY_MISSILE]: COLOR_MISSILE,
  [CATEGORY_UAV]: COLOR_UAV,
  [CATEGORY_FLASH]: COLOR_FLASH,
}

function formatAlertTime(alertDate: string): string {
  // alertDate: "YYYY-MM-DDTHH:MM:SS" — extract the time part
  return alertDate.slice(11, 19)
}

interface CityMarkerProps {
  cityName: string
  categories: ReadonlySet<number>
  latestByCategory: ReadonlyMap<number, string>
  lat: number
  lng: number
  lang: 'he' | 'en'
  tCategory: (slug: string) => string
}

function CityMarker({ cityName, categories, latestByCategory, lat, lng, lang, tCategory }: CityMarkerProps) {
  const hasMissile = categories.has(CATEGORY_MISSILE)
  const hasUAV = categories.has(CATEGORY_UAV)
  const hasFlash = categories.has(CATEGORY_FLASH)
  const isSingleType = categories.size === 1

  const popup = (
    <Popup closeButton={false}>
      <div dir={lang === 'he' ? 'rtl' : 'ltr'} style={lang === 'he' ? { textAlign: 'right' } : undefined}>
        <strong style={{ fontSize: '0.9rem' }}>{cityName}</strong>
        <div style={{ marginTop: 4, fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from(categories).map((catId) => (
            <div key={catId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: CATEGORY_COLORS[catId] ?? '#333', fontWeight: 600 }}>
                {tCategory(CATEGORY_SLUGS[catId] ?? String(catId))}
              </span>
              <span dir="ltr" style={{ color: '#555' }}>
                {formatAlertTime(latestByCategory.get(catId) ?? '')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Popup>
  )

  // Flash never co-occurs with other types per design doc
  if (hasFlash && !hasMissile && !hasUAV) {
    return (
      <CircleMarker
        center={[lat, lng]}
        radius={RADIUS_SINGLE}
        pathOptions={{ fillColor: COLOR_FLASH, color: isSingleType ? '#000' : COLOR_FLASH, fillOpacity: 0.85, weight: 1 }}
      >
        {popup}
      </CircleMarker>
    )
  }

  if (hasMissile && hasUAV) {
    // Concentric rings: outer UAV (larger, transparent fill), inner Missile (filled)
    // Multiple types — no black border
    return (
      <>
        <CircleMarker
          center={[lat, lng]}
          radius={RADIUS_OUTER}
          pathOptions={{ fillColor: COLOR_UAV, color: COLOR_UAV, fillOpacity: 0.35, weight: 2.5 }}
        />
        <CircleMarker
          center={[lat, lng]}
          radius={RADIUS_INNER}
          pathOptions={{ fillColor: COLOR_MISSILE, color: COLOR_MISSILE, fillOpacity: 0.9, weight: 0 }}
        >
          {popup}
        </CircleMarker>
      </>
    )
  }

  if (hasUAV) {
    return (
      <CircleMarker
        center={[lat, lng]}
        radius={RADIUS_SINGLE}
        pathOptions={{ fillColor: COLOR_UAV, color: isSingleType ? '#000' : COLOR_UAV, fillOpacity: 0.85, weight: 1 }}
      >
        {popup}
      </CircleMarker>
    )
  }

  if (hasMissile) {
    return (
      <CircleMarker
        center={[lat, lng]}
        radius={RADIUS_SINGLE}
        pathOptions={{ fillColor: COLOR_MISSILE, color: isSingleType ? '#000' : COLOR_MISSILE, fillOpacity: 0.85, weight: 1 }}
      >
        {popup}
      </CircleMarker>
    )
  }

  // Unknown category — skip rendering
  return null
}

/** Forces the map to invalidate its size after mounting — prevents grey tile areas. */
function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

const LEGEND_ITEMS = [
  { color: COLOR_MISSILE, slug: 'missilealert' },
  { color: COLOR_UAV,     slug: 'uav' },
  { color: COLOR_FLASH,   slug: 'flash' },
]

export function RealtimeMap() {
  const { lang, t, tCategory } = useI18n()
  const { cityAlerts, lastUpdated, loading, error } = useRealtimeAlerts({ lang })

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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

        {Array.from(cityAlerts.entries())
          .filter(([cityName]) => getCityCoords(cityName) !== null)
          .map(([cityName, data]) => {
            const coords = getCityCoords(cityName)!
            return (
              <CityMarker
                key={cityName}
                cityName={cityName}
                categories={data.categories}
                latestByCategory={data.latestByCategory}
                lat={coords.lat}
                lng={coords.lng}
                lang={lang}
                tCategory={tCategory}
              />
            )
          })}
      </MapContainer>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          right: 8,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 8,
          padding: '8px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {LEGEND_ITEMS.map(({ color, slug }) => (
          <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                border: '1px solid #000',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.72rem', color: '#333', whiteSpace: 'nowrap' }}>
              {tCategory(slug)}
            </span>
          </div>
        ))}
      </div>

      {/* Last updated badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(17,17,17,0.82)',
          color: '#fff',
          borderRadius: 8,
          padding: '4px 12px',
          fontSize: '0.75rem',
          fontWeight: 500,
          zIndex: 1000,
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backdropFilter: 'blur(4px)',
        }}
      >
        {loading && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
        )}
        {t('mapLastUpdated')}: <span dir="ltr">{lastUpdatedStr}</span>
      </div>

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 12,
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

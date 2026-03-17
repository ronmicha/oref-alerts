'use client'

import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n'
import { TAB_BAR_HEIGHT, HEADER_HEIGHT } from '@/lib/layout'

// Dynamic imports — Leaflet crashes in SSR. ssr: false guarantees client-only rendering.
const RealtimeMap = dynamic(
  () => import('@/components/RealtimeMap').then((m) => m.RealtimeMap),
  {
    ssr: false,
    loading: () => <MapLoadingPlaceholder />,
  }
)

const HistoryMap = dynamic(
  () => import('@/components/HistoryMap').then((m) => m.HistoryMap),
  {
    ssr: false,
    loading: () => <MapLoadingPlaceholder />,
  }
)

function MapLoadingPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e8e4de',
        color: '#A09890',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      ...
    </div>
  )
}

export type MapMode = 'realtime' | 'history'

interface MapViewProps {
  mode: MapMode
  onModeChange: (mode: MapMode) => void
}

export function MapView({ mode, onModeChange }: MapViewProps) {
  const { t } = useI18n()

  return (
    <div
      style={{
        position: 'fixed',
        top: HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: TAB_BAR_HEIGHT,
      }}
    >
      {/* Floating mode toggle — overlaid on the map */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          gap: 2,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 10,
          padding: '3px 4px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {(['realtime', 'history'] as MapMode[]).map((m) => {
          const isActive = mode === m
          return (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              style={{
                padding: '4px 16px',
                borderRadius: 7,
                border: 'none',
                background: isActive ? '#111111' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {m === 'realtime' ? t('mapModeRealtime') : t('mapModeHistory')}
            </button>
          )
        })}
      </div>

      {mode === 'realtime' ? <RealtimeMap /> : <HistoryMap />}
    </div>
  )
}

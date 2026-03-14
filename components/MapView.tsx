'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { TAB_BAR_HEIGHT } from '@/lib/layout'

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

type MapMode = 'realtime' | 'history'

const TOP_BAR_HEIGHT = 48

export function MapView() {
  const { t } = useI18n()
  const [mode, setMode] = useState<MapMode>('realtime')

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: TAB_BAR_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Mode toggle bar */}
      <div
        style={{
          height: TOP_BAR_HEIGHT,
          background: 'var(--color-header)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          gap: 4,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {(['realtime', 'history'] as MapMode[]).map((m) => {
          const isActive = mode === m
          const label = m === 'realtime' ? t('mapModeRealtime') : t('mapModeHistory')
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '5px 18px',
                borderRadius: 20,
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.2)',
                background: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Map area — fills remaining space above tab bar */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {mode === 'realtime' ? <RealtimeMap /> : <HistoryMap />}
      </div>
    </div>
  )
}

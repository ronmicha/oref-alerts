'use client'

import dynamic from 'next/dynamic'
import { TAB_BAR_HEIGHT, HEADER_HEIGHT, MAP_SUBHEADER_HEIGHT } from '@/lib/layout'

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
}

export function MapView({ mode }: MapViewProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: HEADER_HEIGHT + MAP_SUBHEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: TAB_BAR_HEIGHT,
      }}
    >
      {mode === 'realtime' ? <RealtimeMap /> : <HistoryMap />}
    </div>
  )
}

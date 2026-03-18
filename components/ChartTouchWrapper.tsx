'use client'

import { useState, useRef, type ReactNode } from 'react'

/**
 * Wraps a Recharts chart and blocks tooltip activation during scroll gestures.
 *
 * Recharts shows its tooltip on mousemove, and browsers synthesize mousemove
 * from touch events — including during scroll. This means brushing a bar while
 * scrolling pops an unwanted tooltip.
 *
 * Fix: when a touchmove with Y-delta > threshold is detected, an invisible
 * overlay div is placed over the chart to absorb all synthesized mouse events.
 * The overlay is removed after a short delay following touchend, ensuring no
 * tooltip appears for scroll gestures while tap-to-tooltip still works normally.
 */
export function ChartTouchWrapper({ children }: { children: ReactNode }) {
  const [blocking, setBlocking] = useState(false)
  const startY = useRef(0)
  const scrolling = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <div
      style={{ position: 'relative' }}
      onTouchStart={(e) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        startY.current = e.touches[0].clientY
        scrolling.current = false
      }}
      onTouchMove={(e) => {
        if (!scrolling.current && Math.abs(e.touches[0].clientY - startY.current) > 8) {
          scrolling.current = true
          setBlocking(true)
        }
      }}
      onTouchEnd={() => {
        if (scrolling.current) {
          // Keep the overlay briefly to absorb synthesized click/mousedown after scroll
          timeoutRef.current = setTimeout(() => setBlocking(false), 350)
        }
        scrolling.current = false
      }}
    >
      {blocking && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} />
      )}
      {children}
    </div>
  )
}

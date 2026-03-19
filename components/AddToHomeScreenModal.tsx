'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'

const STORAGE_KEY = 'promptRemindAt'
const REMIND_LATER_MS = 24 * 60 * 60 * 1000

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function shouldShowPrompt(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY)
  // "null" means the user dismissed forever (Add or Don't remind me again)
  if (stored === 'null') return false
  // Not set (first visit) → show immediately (remindAt treated as 0)
  const remindAt = stored ? parseInt(stored, 10) : 0
  return Date.now() > remindAt
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function AddToHomeScreenModal() {
  const { t, lang } = useI18n()
  const [visible, setVisible] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Capture the native install prompt (Android/Chrome)
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    if (isMobileDevice() && shouldShowPrompt()) {
      setVisible(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function handleAdd() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'null')
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt()
      deferredPrompt.current = null
    }
  }

  function handleNever() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'null')
  }

  function handleLater() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, String(Date.now() + REMIND_LATER_MS))
  }

  if (!visible) return null

  const isRtl = lang === 'he'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          background: 'var(--color-card)',
          borderRadius: '1rem',
          padding: '1.5rem',
          maxWidth: '22rem',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
          </svg>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {t('addToHomeTitle')}
          </h2>
        </div>

        {/* Message */}
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--color-text)', margin: 0 }}>
          {t('addToHomeMessage')}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Primary — Add */}
          <button
            onClick={handleAdd}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {t('addToHomeCta')}
          </button>

          {/* Secondary row */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleNever}
              style={{
                flex: 1,
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('addToHomeNever')}
            </button>
            <button
              onClick={handleLater}
              style={{
                flex: 1,
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('addToHomeLater')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

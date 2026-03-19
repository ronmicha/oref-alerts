'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'

const STORAGE_KEY = 'promptRemindAt'
const REMIND_LATER_MS = 24 * 60 * 60 * 1000

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function isIOSDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
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

/** Safari share icon — the standard box-with-arrow-up used in iOS Safari */
function SafariShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: 'middle', color: '#007AFF', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function AddToHomeScreenModal() {
  const { t, lang } = useI18n()
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Capture the native install prompt (Android/Chrome)
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    if (isMobileDevice() && shouldShowPrompt()) {
      setIsIOS(isIOSDevice())
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

        {/* iOS instructions */}
        {isIOS && (
          <div
            style={{
              background: 'rgba(0,122,255,0.07)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)' }}>
              <span style={{ fontWeight: 600, minWidth: '1.1rem' }}>1.</span>
              <SafariShareIcon />
              <span>{t('addToHomeIosStep1')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text)' }}>
              <span style={{ fontWeight: 600, minWidth: '1.1rem' }}>2.</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#007AFF' }} aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>{t('addToHomeIosStep2')}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        {isIOS ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleLater}
              style={{
                flex: 1,
                padding: '0.55rem 0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('addToHomeLater')}
            </button>
            <button
              onClick={handleNever}
              style={{
                flex: 1,
                padding: '0.55rem 0.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('addToHomeIosGotIt')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleNever}
              style={{
                flex: 1,
                padding: '0.55rem 0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '0.78rem',
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
                padding: '0.55rem 0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('addToHomeLater')}
            </button>
            <button
              onClick={handleAdd}
              style={{
                flex: 1,
                padding: '0.55rem 0.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('addToHomeCta')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'

const BITPAY_URL = 'https://www.bitpay.co.il/app/me/05921C5E-8748-4635-48C0-CA76D1DE67145239'

export function DonateFAB() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <>
      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Support this project"
          style={{
            position: 'fixed',
            bottom: '5rem',
            insetInlineEnd: '1.25rem',
            width: '17rem',
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            padding: '1.25rem',
            zIndex: 50,
          }}
        >
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text)', marginBottom: '0.9rem' }}>
            {t('donateText1')}
          </p>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text)', marginBottom: '1rem' }}>
            {t('donateText2')}
          </p>

          {isMobile ? (
            <a
              href={BITPAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: '0.5rem',
                padding: '0.55rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('donateCta')}
            </a>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                {t('donateQrLabel')}
              </p>
              <Image
                src="/donate-qr.jpeg"
                alt="Donation QR code"
                width={180}
                height={180}
                style={{ borderRadius: '0.5rem', display: 'inline-block' }}
              />
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Support this project"
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          insetInlineEnd: '1.25rem',
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          background: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(204,18,18,0.35)',
          zIndex: 50,
          transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-accent)')}
      >
        ❤️
      </button>
    </>
  )
}

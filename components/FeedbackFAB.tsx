'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'
import { TAB_BAR_HEIGHT } from '@/lib/layout'

const WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=523857444'

export function FeedbackFAB() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
          aria-label="Feedback"
          style={{
            position: 'fixed',
            bottom: TAB_BAR_HEIGHT + 64 + 'px',
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
            {t('fabText1')}
          </p>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
            {t('fabText2')}
          </p>
          <div style={{ textAlign: 'center' }}>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('fabWhatsAppLabel')}
              style={{ display: 'inline-block' }}
            >
              <Image
                src="/WhatsApp.svg"
                alt={t('fabWhatsAppLabel')}
                width={40}
                height={40}
                style={{ display: 'block' }}
              />
            </a>
          </div>
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
          bottom: TAB_BAR_HEIGHT + 20 + 'px',
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

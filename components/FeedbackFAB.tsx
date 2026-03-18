'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import { TAB_BAR_HEIGHT } from '@/lib/layout'

const WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=523857444'

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="28"
      height="28"
      aria-hidden="true"
    >
      <path
        fill="#25D366"
        d="M24 4C12.95 4 4 12.95 4 24c0 3.55.95 6.87 2.6 9.74L4 44l10.53-2.56A19.87 19.87 0 0 0 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4z"
      />
      <path
        fill="#fff"
        d="M35.2 29.6c-.5-.25-2.94-1.45-3.4-1.62-.45-.17-.78-.25-1.1.25-.33.5-1.27 1.62-1.56 1.95-.29.33-.57.37-1.07.12-.5-.25-2.1-.77-4-2.47-1.48-1.32-2.48-2.95-2.77-3.45-.29-.5-.03-.77.22-1.02.22-.22.5-.58.75-.87.25-.29.33-.5.5-.83.17-.33.08-.62-.04-.87-.12-.25-1.1-2.65-1.5-3.63-.4-.95-.8-.82-1.1-.83-.28-.01-.6-.01-.93-.01-.33 0-.87.12-1.33.62-.45.5-1.72 1.68-1.72 4.1 0 2.4 1.76 4.73 2.01 5.06.25.33 3.47 5.3 8.41 7.43 1.17.5 2.09.8 2.8 1.03 1.18.37 2.25.32 3.1.19.94-.14 2.94-1.2 3.35-2.36.42-1.16.42-2.15.3-2.36-.12-.2-.45-.33-.95-.57z"
      />
    </svg>
  )
}

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
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('fabWhatsAppLabel')}
            style={{ display: 'inline-flex' }}
          >
            <WhatsAppIcon />
          </a>
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

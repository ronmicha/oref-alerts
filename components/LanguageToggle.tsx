'use client'

import { useI18n } from '@/lib/i18n'

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()

  return (
    <button
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      aria-label="Toggle language"
      style={{
        padding: '0.3rem 0.875rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.22)',
        color: 'rgba(255,255,255,0.82)',
        background: 'transparent',
        cursor: 'pointer',
        letterSpacing: '0.01em',
        fontFamily: 'var(--font-body)',
      }}
    >
      {t('langToggle')}
    </button>
  )
}

'use client'

import { useI18n } from '@/lib/i18n'

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()

  return (
    <button
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      className="px-3 py-1 text-sm font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
      aria-label="Toggle language"
    >
      {t('langToggle')}
    </button>
  )
}

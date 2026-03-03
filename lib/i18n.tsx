'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import he from './translations/he.json'
import en from './translations/en.json'

type Lang = 'he' | 'en'
type Translations = typeof he

const translations: Record<Lang, Translations> = { he, en }

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: keyof Omit<Translations, 'categories'>, vars?: Record<string, string | number>) => string
  tCategory: (slug: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('he')
  const dict = translations[lang]

  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  function t(key: keyof Omit<Translations, 'categories'>, vars?: Record<string, string | number>): string {
    let str = dict[key] as string
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  function tCategory(slug: string): string {
    return (dict.categories as Record<string, string>)[slug] ?? slug
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tCategory }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

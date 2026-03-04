import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'שאגת הארי - התראות',
  description: 'עקוב אחר היסטוריית התראות פיקוד העורף לפי עיר, קטגוריה ושעה ביום',
  openGraph: {
    title: 'שאגת הארי - התראות',
    description: 'עקוב אחר היסטוריית התראות פיקוד העורף לפי עיר, קטגוריה ושעה ביום',
    type: 'website',
    locale: 'he_IL',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}

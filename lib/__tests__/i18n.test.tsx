import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n'

function TestConsumer() {
  const { t, lang, setLang } = useI18n()
  return (
    <div>
      <span data-testid="title">{t('appTitle')}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>toggle</button>
    </div>
  )
}

describe('I18nProvider', () => {
  it('defaults to Hebrew', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('he')
    expect(screen.getByTestId('title').textContent).toBe('שאגת הארי - התרעות')
  })

  it('switches to English on toggle', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>)
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('lang').textContent).toBe('en')
    expect(screen.getByTestId('title').textContent).toBe("Lion's Roar - Alerts")
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageToggle } from '../LanguageToggle'
import { I18nProvider, useI18n } from '@/lib/i18n'

function renderToggle() {
  return render(
    <I18nProvider>
      <LanguageToggle />
    </I18nProvider>
  )
}

// Renders the toggle pre-switched to English so we can test English mode
function renderToggleEn() {
  return render(
    <I18nProvider>
      <EnSwitcher />
      <LanguageToggle />
    </I18nProvider>
  )
}

function EnSwitcher() {
  const { setLang } = useI18n()
  return (
    <button data-testid="switch-to-en" onClick={() => setLang('en')}>
      switch
    </button>
  )
}

// Renders the toggle and also exposes the current lang for assertions
function LangDisplay() {
  const { lang } = useI18n()
  return <span data-testid="lang-display">{lang}</span>
}

function renderToggleWithDisplay() {
  return render(
    <I18nProvider>
      <LangDisplay />
      <LanguageToggle />
    </I18nProvider>
  )
}

describe('LanguageToggle', () => {
  it('shows "English" button text in Hebrew mode (default)', () => {
    renderToggle()
    // I18nProvider defaults to Hebrew; langToggle in he.json is "English"
    expect(screen.getByRole('button', { name: /Toggle language/i })).toHaveTextContent('English')
  })

  it('shows "עברית" button text in English mode', () => {
    renderToggleEn()
    fireEvent.click(screen.getByTestId('switch-to-en'))
    // langToggle in en.json is "עברית"
    expect(screen.getByRole('button', { name: /Toggle language/i })).toHaveTextContent('עברית')
  })

  it('switches lang from "he" to "en" when the button is clicked', () => {
    renderToggleWithDisplay()
    expect(screen.getByTestId('lang-display')).toHaveTextContent('he')
    fireEvent.click(screen.getByRole('button', { name: /Toggle language/i }))
    expect(screen.getByTestId('lang-display')).toHaveTextContent('en')
  })

  it('switches lang from "en" back to "he" when the button is clicked again', () => {
    renderToggleEn()
    fireEvent.click(screen.getByTestId('switch-to-en'))
    // Now in English mode — clicking toggle should go back to Hebrew
    const toggleBtn = screen.getByRole('button', { name: /Toggle language/i })
    fireEvent.click(toggleBtn)
    // After clicking back to Hebrew, button should show "English" again
    expect(toggleBtn).toHaveTextContent('English')
  })
})

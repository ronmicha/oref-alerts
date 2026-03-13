import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '../FilterBar'
import { I18nProvider } from '@/lib/i18n'

const defaultProps = {
  dateRange: '7d' as const,
  onDateRangeChange: jest.fn(),
  cityLabel: '',
  onCityLabelChange: jest.fn(),
  categoryId: undefined,
  onCategoryIdChange: jest.fn(),
  cityLabels: ['תל אביב | גוש דן', 'ירושלים | ירושלים'],
  categories: [
    { id: 1, category: 'missilealert', matrix_id: 1, priority: 120, queue: false },
    { id: 2, category: 'uav', matrix_id: 6, priority: 130, queue: false },
  ],
  customFrom: '',
  onCustomFromChange: jest.fn(),
  customTo: '',
  onCustomToChange: jest.fn(),
}

function renderFilterBar(props = {}) {
  return render(
    <I18nProvider>
      <FilterBar {...defaultProps} {...props} />
    </I18nProvider>
  )
}

// Helper to render with English language active
function renderFilterBarEn(props = {}) {
  return render(
    <I18nProvider>
      <LangSwitcher />
      <FilterBar {...defaultProps} {...props} />
    </I18nProvider>
  )
}

// A helper component that switches the language to English on mount
function LangSwitcher() {
  const { setLang } = require('@/lib/i18n').useI18n()
  // Use a button to trigger the switch so we can fire it after render
  return (
    <button data-testid="switch-to-en" onClick={() => setLang('en')}>
      switch
    </button>
  )
}

describe('FilterBar', () => {
  it('renders date range select with default value', () => {
    renderFilterBar()
    expect(screen.getByDisplayValue('7 ימים אחרונים')).toBeInTheDocument()
  })

  it('renders city input with empty value', () => {
    renderFilterBar()
    // City input has role="combobox"; it is the second combobox (after date range select)
    const cityInput = screen.getAllByRole('combobox')[1]
    expect(cityInput).toHaveValue('')
  })

  it('calls onDateRangeChange when date range changes', () => {
    const onDateRangeChange = jest.fn()
    renderFilterBar({ onDateRangeChange })
    const select = screen.getAllByRole('combobox')[0]
    fireEvent.change(select, { target: { value: '30d' } })
    expect(onDateRangeChange).toHaveBeenCalledWith('30d')
  })

  it('calls onCityLabelChange when city input is cleared', () => {
    const onCityLabelChange = jest.fn()
    renderFilterBar({ cityLabel: 'תל אביב | גוש דן', onCityLabelChange })
    const input = screen.getAllByRole('combobox')[1]
    fireEvent.change(input, { target: { value: '' } })
    expect(onCityLabelChange).toHaveBeenCalledWith('')
  })

  // --- Custom date pickers ---

  it('shows From-date and To-date inputs when dateRange is "custom"', () => {
    renderFilterBar({ dateRange: 'custom' })
    // Labels are not associated via htmlFor, use getByText + check for date inputs
    expect(screen.getByText('מתאריך')).toBeInTheDocument()
    expect(screen.getByText('עד תאריך')).toBeInTheDocument()
    const dateInputs = screen.getAllByDisplayValue('')
    // At least two date inputs should be present (customFrom and customTo)
    const dateTypeInputs = dateInputs.filter(
      (el) => el.getAttribute('type') === 'date'
    )
    expect(dateTypeInputs).toHaveLength(2)
  })

  it.each(['24h', '7d', '30d'] as const)(
    'hides custom date pickers for preset "%s"',
    (preset) => {
      renderFilterBar({ dateRange: preset })
      expect(screen.queryByText('מתאריך')).not.toBeInTheDocument()
      expect(screen.queryByText('עד תאריך')).not.toBeInTheDocument()
    }
  )

  // --- Category select ---

  it('renders all provided categories as options', () => {
    renderFilterBar()
    const categorySelect = screen.getAllByRole('combobox')[2]
    // Hebrew translations for the two categories in defaultProps
    expect(within(categorySelect).getByText('ירי רקטות וטילים')).toBeInTheDocument()
    expect(within(categorySelect).getByText('חדירת כלי טיס עוין')).toBeInTheDocument()
  })

  it('calls onCategoryIdChange with a number when a category is selected', () => {
    const onCategoryIdChange = jest.fn()
    renderFilterBar({ onCategoryIdChange })
    const categorySelect = screen.getAllByRole('combobox')[2]
    fireEvent.change(categorySelect, { target: { value: '1' } })
    expect(onCategoryIdChange).toHaveBeenCalledWith(1)
    expect(typeof onCategoryIdChange.mock.calls[0][0]).toBe('number')
  })

  it('calls onCategoryIdChange with undefined when "All" option is selected', () => {
    const onCategoryIdChange = jest.fn()
    renderFilterBar({ categoryId: 1, onCategoryIdChange })
    const categorySelect = screen.getAllByRole('combobox')[2]
    fireEvent.change(categorySelect, { target: { value: '' } })
    expect(onCategoryIdChange).toHaveBeenCalledWith(undefined)
  })

  // --- City combobox ---

  it('filters city options by typed input', async () => {
    renderFilterBar()
    const cityInput = screen.getAllByRole('combobox')[1]
    fireEvent.change(cityInput, { target: { value: 'ירושלים' } })
    // Only "ירושלים | ירושלים" should appear; "תל אביב | גוש דן" should not
    expect(await screen.findByRole('option', { name: 'ירושלים | ירושלים' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'תל אביב | גוש דן' })).not.toBeInTheDocument()
  })

  it('calls onCityLabelChange with the city name when an option is selected', async () => {
    const onCityLabelChange = jest.fn()
    renderFilterBar({ onCityLabelChange })
    const cityInput = screen.getAllByRole('combobox')[1]
    // Open the dropdown by focusing
    fireEvent.focus(cityInput)
    // Click on the first option
    const option = await screen.findByRole('option', { name: 'תל אביב | גוש דן' })
    fireEvent.mouseDown(option)
    expect(onCityLabelChange).toHaveBeenCalledWith('תל אביב | גוש דן')
  })

  it('clears city selection when the clear (✕) button is clicked', async () => {
    const onCityLabelChange = jest.fn()
    renderFilterBar({ cityLabel: 'תל אביב | גוש דן', onCityLabelChange })
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.mouseDown(clearBtn)
    expect(onCityLabelChange).toHaveBeenCalledWith('')
  })

  it('reverts city input to committed value when Escape is pressed', () => {
    const onCityLabelChange = jest.fn()
    // Committed value (prop) is '' (no city selected). User types a partial search
    // that still matches options so the dropdown stays open.
    renderFilterBar({ cityLabel: '', onCityLabelChange })
    const cityInput = screen.getAllByRole('combobox')[1]
    // Focus opens the dropdown (matches all cities)
    fireEvent.focus(cityInput)
    // Type a partial query — still matches 'תל אביב | גוש דן', so matches.length > 0
    // and the Escape handler won't early-return
    fireEvent.change(cityInput, { target: { value: 'תל' } })
    expect(cityInput).toHaveValue('תל')
    // Press Escape — component reverts input to committed value '' (the `value` prop)
    fireEvent.keyDown(cityInput, { key: 'Escape' })
    expect(cityInput).toHaveValue('')
  })

  // --- Language ---

  it('renders in English with translated labels when I18nProvider language is set to English', () => {
    renderFilterBarEn()
    // Switch to English
    fireEvent.click(screen.getByTestId('switch-to-en'))
    // English labels from en.json — labels are plain text, not associated via htmlFor
    expect(screen.getByText('Date range')).toBeInTheDocument()
    expect(screen.getByText('City')).toBeInTheDocument()
    expect(screen.getByText('Alert type')).toBeInTheDocument()
  })
})

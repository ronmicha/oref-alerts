import { render, screen, fireEvent } from '@testing-library/react'
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
}

function renderFilterBar(props = {}) {
  return render(
    <I18nProvider>
      <FilterBar {...defaultProps} {...props} />
    </I18nProvider>
  )
}

describe('FilterBar', () => {
  it('renders date range select with default value', () => {
    renderFilterBar()
    expect(screen.getByDisplayValue('7 ימים אחרונים')).toBeInTheDocument()
  })

  it('renders city input with empty value', () => {
    renderFilterBar()
    const cityInput = screen.getByRole('textbox')
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
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '' } })
    expect(onCityLabelChange).toHaveBeenCalledWith('')
  })
})

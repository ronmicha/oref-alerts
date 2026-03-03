import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '../FilterBar'
import { I18nProvider } from '@/lib/i18n'

const defaultProps = {
  dateRange: '7d' as const,
  onDateRangeChange: jest.fn(),
  areaname: '',
  onAreanameChange: jest.fn(),
  categoryId: undefined,
  onCategoryIdChange: jest.fn(),
  areas: ['גוש דן', 'ירושלים'],
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

  it('renders district dropdown with All option', () => {
    renderFilterBar()
    const districtSelect = screen.getAllByRole('combobox')[1]
    expect(districtSelect).toHaveValue('')
  })

  it('calls onDateRangeChange when date range changes', () => {
    const onDateRangeChange = jest.fn()
    renderFilterBar({ onDateRangeChange })
    const select = screen.getAllByRole('combobox')[0]
    fireEvent.change(select, { target: { value: '30d' } })
    expect(onDateRangeChange).toHaveBeenCalledWith('30d')
  })

  it('calls onAreanameChange when district changes', () => {
    const onAreanameChange = jest.fn()
    renderFilterBar({ onAreanameChange })
    const select = screen.getAllByRole('combobox')[1]
    fireEvent.change(select, { target: { value: 'גוש דן' } })
    expect(onAreanameChange).toHaveBeenCalledWith('גוש דן')
  })
})

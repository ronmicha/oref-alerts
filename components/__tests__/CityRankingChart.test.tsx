import { render, screen, fireEvent } from '@testing-library/react'
import { CityRankingChart } from '../CityRankingChart'
import { I18nProvider } from '@/lib/i18n'
import type { CityCount } from '@/types/oref'

// I18nProvider defaults to Hebrew ('he') — all strings come from he.json

const defaultCities: CityCount[] = [
  { label: 'תל אביב', count: 10 },
  { label: 'ירושלים', count: 7 },
  { label: 'חיפה', count: 3 },
]

const defaultProps = {
  cities: defaultCities,
  loading: false,
  error: null,
  subtitle: '01/01 - 31/01',
  cityLabels: ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע'],
}

function renderChart(props: Partial<typeof defaultProps> = {}) {
  return render(
    <I18nProvider>
      <CityRankingChart {...defaultProps} {...props} />
    </I18nProvider>
  )
}

describe('CityRankingChart', () => {
  it('shows loading text while loading=true', () => {
    renderChart({ loading: true })
    // Hebrew: "טוען..."
    expect(screen.getByText('טוען...')).toBeInTheDocument()
    // Table should not be rendered
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows error message when error is set and not loading', () => {
    renderChart({ error: 'some error', loading: false, cities: [] })
    // Hebrew: "שגיאה בטעינת הנתונים"
    expect(screen.getByText('שגיאה בטעינת הנתונים')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows empty state when cities=[]', () => {
    renderChart({ cities: [], loading: false, error: null })
    // Hebrew: from cityRankingEmpty key
    expect(screen.getByText('אין ערים עם התרעות בתקופה זו')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders a row per city', () => {
    renderChart()
    const rows = screen.getAllByRole('row')
    // 1 header row + 3 city rows
    expect(rows).toHaveLength(4)
    expect(screen.getByText('תל אביב')).toBeInTheDocument()
    expect(screen.getByText('ירושלים')).toBeInTheDocument()
    expect(screen.getByText('חיפה')).toBeInTheDocument()
  })

  it('shows ranks correctly (#1, #2, #3)', () => {
    renderChart()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('renders alert counts as raw numbers (not toLocaleString)', () => {
    renderChart()
    // JSX renders {city.count} directly
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('sort toggle reverses row order (least first after click)', () => {
    renderChart()
    const rows = screen.getAllByRole('row')
    // Initial order: most alerts first → תל אביב, ירושלים, חיפה
    const cells = screen.getAllByRole('cell')
    // city name cells are every 2nd cell (index 1, 4, 7 out of 0-indexed)
    // rows[1] = first data row: rank, city, count
    const firstCityCell = rows[1].querySelectorAll('td')[1]
    expect(firstCityCell.textContent).toBe('תל אביב')

    // Click sort toggle (the Alerts column button)
    const sortButton = screen.getByRole('button', { name: /התרעות/i })
    fireEvent.click(sortButton)

    const rowsAfter = screen.getAllByRole('row')
    const lastFirstCity = rowsAfter[1].querySelectorAll('td')[1]
    // After toggle (sortDesc=false, least first): חיפה should come first
    expect(lastFirstCity.textContent).toBe('חיפה')
  })

  it('shows "Top 50 of N" subtitle when cities.length > 50 and sortDesc=true', () => {
    const manyCities: CityCount[] = Array.from({ length: 51 }, (_, i) => ({
      label: `City${i}`,
      count: 51 - i,
    }))
    renderChart({ cities: manyCities, subtitle: '01/01 - 31/01' })
    // Hebrew cityRankingTop: "{n} ראשונות מתוך {total} ערים"
    // n=50 (sliced), total=51 (withAlerts.length)
    expect(screen.getByText(/50 ראשונות מתוך 51 ערים/)).toBeInTheDocument()
  })

  it('shows "Bottom 50 of N" subtitle after clicking sort toggle', () => {
    const manyCities: CityCount[] = Array.from({ length: 51 }, (_, i) => ({
      label: `City${i}`,
      count: 51 - i,
    }))
    renderChart({ cities: manyCities, subtitle: '01/01 - 31/01' })

    // Click sort toggle to switch to least-first
    const sortButton = screen.getByRole('button', { name: /התרעות/i })
    fireEvent.click(sortButton)

    // Hebrew cityRankingBottom: "{n} אחרונות מתוך {total} ערים"
    // n=50 (sliced), total=51
    expect(screen.getByText(/50 אחרונות מתוך 51 ערים/)).toBeInTheDocument()
  })

  it('renders the subtitle prop value in the subtitle paragraph', () => {
    renderChart({ subtitle: '01/03 - 13/03' })
    expect(screen.getByText(/01\/03 - 13\/03/)).toBeInTheDocument()
  })

  it('compare mode: adding a city via combobox adds a chip', () => {
    renderChart()
    const combobox = screen.getByRole('combobox')
    // Focus and type to open dropdown
    fireEvent.focus(combobox)
    fireEvent.change(combobox, { target: { value: 'באר שבע' } })

    // Click on the option in the listbox
    const option = screen.getByRole('option', { name: 'באר שבע' })
    fireEvent.mouseDown(option)

    // Chip should appear — verified by presence of the remove button
    expect(screen.getByRole('button', { name: 'Remove באר שבע' })).toBeInTheDocument()
  })

  it('compare mode: removing a chip removes the city row', () => {
    // Pre-select a city that has alerts so it shows as a row
    renderChart()

    const combobox = screen.getByRole('combobox')
    fireEvent.focus(combobox)
    fireEvent.change(combobox, { target: { value: 'תל אביב' } })
    const option = screen.getByRole('option', { name: 'תל אביב' })
    fireEvent.mouseDown(option)

    // תל אביב chip and row both visible
    expect(screen.getByRole('button', { name: 'Remove תל אביב' })).toBeInTheDocument()

    // Click remove button for תל אביב
    const removeBtn = screen.getByRole('button', { name: 'Remove תל אביב' })
    fireEvent.click(removeBtn)

    // Chip should be gone; no more remove button
    expect(screen.queryByRole('button', { name: 'Remove תל אביב' })).not.toBeInTheDocument()
  })

  it('city with count=0 shows em-dash in rank and count columns', () => {
    // Add ערד via compare mode — it's not in the cities prop (count=0)
    renderChart({
      cities: [{ label: 'תל אביב', count: 5 }],
      cityLabels: ['תל אביב', 'ערד'],
    })

    const combobox = screen.getByRole('combobox')
    fireEvent.focus(combobox)
    fireEvent.change(combobox, { target: { value: 'ערד' } })
    const option = screen.getByRole('option', { name: 'ערד' })
    fireEvent.mouseDown(option)

    // ערד has count=0 → rank and count cells should show "—"
    const rows = screen.getAllByRole('row')
    const aredRow = Array.from(rows).find((row) =>
      Array.from(row.querySelectorAll('td')).some((td) => td.textContent === 'ערד')
    )
    expect(aredRow).toBeDefined()
    const tds = aredRow!.querySelectorAll('td')
    expect(tds[0].textContent).toBe('—')
    expect(tds[2].textContent).toBe('—')
  })

  it('city added via compare mode with count=0 shows em-dash in rank and count', () => {
    const citiesWithZero: CityCount[] = [
      { label: 'תל אביב', count: 5 },
    ]
    // ערד has no alerts (not in cities array), but is a valid city label
    renderChart({
      cities: citiesWithZero,
      cityLabels: ['תל אביב', 'ערד'],
    })

    const combobox = screen.getByRole('combobox')
    fireEvent.focus(combobox)
    fireEvent.change(combobox, { target: { value: 'ערד' } })
    const option = screen.getByRole('option', { name: 'ערד' })
    fireEvent.mouseDown(option)

    // Both cities selected in compare mode (also add תל אביב)
    const combobox2 = screen.getByRole('combobox')
    fireEvent.focus(combobox2)
    fireEvent.change(combobox2, { target: { value: 'תל אביב' } })
    const option2 = screen.getByRole('option', { name: 'תל אביב' })
    fireEvent.mouseDown(option2)

    // Now the table shows both. ערד has count=0 → should show "—" in rank and count
    const rows = screen.getAllByRole('row')
    // Find the row for ערד
    const aredRow = Array.from(rows).find((row) =>
      Array.from(row.querySelectorAll('td')).some((td) => td.textContent === 'ערד')
    )
    expect(aredRow).toBeDefined()
    const tds = aredRow!.querySelectorAll('td')
    expect(tds[0].textContent).toBe('—') // rank cell
    expect(tds[2].textContent).toBe('—') // count cell
  })
})

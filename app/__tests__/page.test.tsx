/**
 * Page-level user flow tests for app/page.tsx.
 *
 * All five data hooks are mocked so we never hit the network. The page
 * renders its own I18nProvider internally (via app/layout.tsx), but in tests
 * we render <Page /> directly, so we wrap it with I18nProvider ourselves.
 *
 * React Query is used by useCities / useCategories / useCityRankings, but
 * since all hooks are mocked those queries never run. We still need a
 * QueryClientProvider to satisfy any QueryClient context assertions that
 * the real components may make during render. We provide a minimal one.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/lib/i18n'
import Page from '../page'

import { alertHistory } from '@/tests/fixtures/alertHistory'
import { cities } from '@/tests/fixtures/cities'
import { categories } from '@/tests/fixtures/categories'

// ─── Mock all data hooks ─────────────────────────────────────────────────────

jest.mock('@/hooks/useAlerts')
jest.mock('@/hooks/useTzevaadomAlerts')
jest.mock('@/hooks/useCities')
jest.mock('@/hooks/useCategories')
jest.mock('@/hooks/useCityRankings')

// ─── Mock MapView (uses dynamic imports / Leaflet which are unavailable in jsdom) ──

jest.mock('@/components/MapView', () => ({
  MapView: () => <div data-testid="map-view">Map View</div>,
}))

// ─── Mock heavy chart components to avoid recharts/canvas issues ─────────────

jest.mock('@/components/ByDayChart', () => ({
  ByDayChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="by-day-chart" data-count={data.length} />
  ),
}))

jest.mock('@/components/TimeOfDayChart', () => ({
  TimeOfDayChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="time-of-day-chart" data-count={data.length} />
  ),
}))

jest.mock('@/components/CityRankingChart', () => ({
  CityRankingChart: ({ cities: c }: { cities: unknown[] }) => (
    <div data-testid="city-ranking-chart" data-count={c.length} />
  ),
}))

// ─── Import mocked hooks so we can configure return values ───────────────────

import { useAlerts } from '@/hooks/useAlerts'
import { useTzevaadomAlerts } from '@/hooks/useTzevaadomAlerts'
import { useCities } from '@/hooks/useCities'
import { useCategories } from '@/hooks/useCategories'
import { useCityRankings } from '@/hooks/useCityRankings'

const mockUseAlerts = useAlerts as jest.Mock
const mockUseTzevaadomAlerts = useTzevaadomAlerts as jest.Mock
const mockUseCities = useCities as jest.Mock
const mockUseCategories = useCategories as jest.Mock
const mockUseCityRankings = useCityRankings as jest.Mock

// ─── Default mock return values ──────────────────────────────────────────────

const mockRetry = jest.fn()
const mockRankRefetch = jest.fn()
const mockTzevaadomRefetch = jest.fn()

function setupDefaultMocks() {
  mockUseAlerts.mockReturnValue({
    alerts: alertHistory,
    loading: false,
    error: null,
    retry: mockRetry,
  })

  mockUseTzevaadomAlerts.mockReturnValue({
    alerts: [],
    loading: false,
    error: null,
    refetch: mockTzevaadomRefetch,
  })

  mockUseCities.mockReturnValue({
    cities,
    // Provide city labels matching fixture city names (Hebrew mode labels)
    cityLabels: ['תל אביב - מרכז העיר', 'ירושלים'],
    loading: false,
    error: null,
  })

  mockUseCategories.mockReturnValue({
    categories,
    loading: false,
    error: null,
  })

  mockUseCityRankings.mockReturnValue({
    cities: [],
    loading: false,
    error: null,
    refetch: mockRankRefetch,
  })
}

// ─── Render helper ────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderPage() {
  const qc = makeQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <Page />
      </I18nProvider>
    </QueryClientProvider>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  setupDefaultMocks()
})

describe('Page user-flow tests', () => {
  // 1. Summary count shows total filtered alerts
  it('summary count shows total filtered alerts', () => {
    renderPage()
    // alertHistory has 4 entries; getPresetDateRange returns a range that covers them all
    // since the fixture dates (2026-03-01, 2026-03-02) are within the last 24h range
    // relative to today (2026-03-13). Actually dateRange='24h' will produce a startDate
    // of 2026-03-12, which is AFTER the fixture dates, so filteredAlerts will be 0.
    //
    // The page filters by startDate/endDate. The fixtures use 2026-03-01 and 2026-03-02,
    // but today is 2026-03-13. With '24h' preset, startDate = 2026-03-12. Fixtures are
    // outside that window → count = 0.
    //
    // We verify that the count badge is rendered (whatever the number).
    // The badge is the element containing "סה״כ" (Total).
    const totalLabel = screen.getByText('סה״כ')
    expect(totalLabel).toBeInTheDocument()
    // With 24h range and fixture dates in the past, count = 0
    const countSpan = screen.getByTestId('alert-count')
    expect(countSpan).toHaveTextContent('0')
  })

  // 1b. Summary count shows correct total when dates are within range (tzevaadom path)
  it('summary count reflects tzevaadom alerts when custom range is selected', () => {
    // In custom mode the page uses tzevaadomAlerts. We mock those to have 3 alerts.
    const customAlerts = alertHistory.slice(0, 3)
    mockUseTzevaadomAlerts.mockReturnValue({
      alerts: customAlerts,
      loading: false,
      error: null,
      refetch: mockTzevaadomRefetch,
    })

    renderPage()
    // Switch to custom date range
    const dateRangeSelect = screen.getByDisplayValue('24 שעות אחרונות')
    fireEvent.change(dateRangeSelect, { target: { value: 'custom' } })

    // Enter from/to that covers all fixture dates
    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-03-02' } })

    // filterAlerts with those dates will pass all 3 alerts through
    const countSpan = screen.getByTestId('alert-count')
    expect(countSpan).toHaveTextContent('3')
  })

  // 2. Changing date range calls useAlerts with correct mode
  it('switching to 7d calls useAlerts with mode=2', () => {
    renderPage()
    const dateRangeSelect = screen.getByDisplayValue('24 שעות אחרונות')
    fireEvent.change(dateRangeSelect, { target: { value: '7d' } })

    // After state update useAlerts should have been called with mode=2
    expect(mockUseAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 2 })
    )
  })

  // 4. Category filter reduces displayed count
  it('category filter reduces displayed alert count', () => {
    // Use alerts dated within the last hour (definitely within the 24h window)
    const now = new Date()
    const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    function toLocalAlertDate(d: Date) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}T${hh}:${min}:00`
    }

    const recentAlerts = [
      { ...alertHistory[0], alertDate: toLocalAlertDate(anHourAgo), category: 1 },
      { ...alertHistory[1], alertDate: toLocalAlertDate(anHourAgo), category: 2 },
      { ...alertHistory[2], alertDate: toLocalAlertDate(twoHoursAgo), category: 2 },
      { ...alertHistory[3], alertDate: toLocalAlertDate(twoHoursAgo), category: 1 },
    ]

    mockUseAlerts.mockReturnValue({
      alerts: recentAlerts,
      loading: false,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    // Initial count: 4
    const countSpan = screen.getByTestId('alert-count')
    expect(countSpan).toHaveTextContent('4')

    // Select category 2 (uav) — only 2 alerts match
    const categoryLabel = screen.getByText('סוג התרעה')
    const categorySelect = categoryLabel.closest('div')!.querySelector('select')!
    fireEvent.change(categorySelect, { target: { value: '2' } })

    expect(countSpan).toHaveTextContent('2')
  })

  // 5. City filter selection reduces displayed count (with recent alerts)
  it('city filter selection reduces displayed count', () => {
    function toLocalAlertDate(d: Date) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}T${hh}:${min}:00`
    }
    const now = new Date()
    const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    const recentAlerts = [
      { ...alertHistory[0], data: 'תל אביב - מרכז העיר', alertDate: toLocalAlertDate(anHourAgo) },
      { ...alertHistory[1], data: 'ירושלים', alertDate: toLocalAlertDate(anHourAgo) },
      { ...alertHistory[2], data: 'תל אביב - מרכז העיר', alertDate: toLocalAlertDate(twoHoursAgo) },
      { ...alertHistory[3], data: 'ירושלים', alertDate: toLocalAlertDate(twoHoursAgo) },
    ]

    mockUseAlerts.mockReturnValue({
      alerts: recentAlerts,
      loading: false,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    // Initial count: 4
    const countSpan = screen.getByTestId('alert-count')
    expect(countSpan).toHaveTextContent('4')

    // Type in city combobox to filter by 'ירושלים' (2 alerts)
    const cityInput = screen.getByPlaceholderText('הכל')
    fireEvent.focus(cityInput)
    fireEvent.change(cityInput, { target: { value: 'ירושלים' } })

    // Select the option from the dropdown
    const option = screen.getByRole('option', { name: 'ירושלים' })
    fireEvent.mouseDown(option)

    // After selecting Jerusalem, count should drop to 2
    expect(countSpan).toHaveTextContent('2')
  })

  // 6. Clearing city filter restores full count
  it('clearing city filter restores full count', () => {
    function toLocalAlertDate(d: Date) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}T${hh}:${min}:00`
    }
    const now = new Date()
    const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    const recentAlerts = [
      { ...alertHistory[0], data: 'תל אביב - מרכז העיר', alertDate: toLocalAlertDate(anHourAgo) },
      { ...alertHistory[1], data: 'ירושלים', alertDate: toLocalAlertDate(anHourAgo) },
      { ...alertHistory[2], data: 'תל אביב - מרכז העיר', alertDate: toLocalAlertDate(twoHoursAgo) },
      { ...alertHistory[3], data: 'ירושלים', alertDate: toLocalAlertDate(twoHoursAgo) },
    ]

    mockUseAlerts.mockReturnValue({
      alerts: recentAlerts,
      loading: false,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    const countSpan = screen.getByTestId('alert-count')

    // Select Jerusalem (2 alerts)
    const cityInput = screen.getByPlaceholderText('הכל')
    fireEvent.focus(cityInput)
    fireEvent.change(cityInput, { target: { value: 'ירושלים' } })
    const option = screen.getByRole('option', { name: 'ירושלים' })
    fireEvent.mouseDown(option)
    expect(countSpan).toHaveTextContent('2')

    // Clear city filter — click the clear (✕) button
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.mouseDown(clearBtn)

    // Count should return to 4
    expect(countSpan).toHaveTextContent('4')
  })

  // 7. Language toggle switches UI to English
  it('language toggle switches UI to English', () => {
    renderPage()

    // Default is Hebrew: button shows "English"
    const langToggle = screen.getByRole('button', { name: /toggle language/i })
    expect(langToggle).toHaveTextContent('English')

    // Click to switch to English
    fireEvent.click(langToggle)

    // Now button shows "עברית" (Hebrew word for Hebrew)
    expect(langToggle).toHaveTextContent('עברית')

    // Chart title should be in English
    expect(screen.getByText('Alerts by Day')).toBeInTheDocument()
    expect(screen.getByText('Alerts by Time of Day')).toBeInTheDocument()
  })

  // 8. Language toggle resets city and category filters
  it('language toggle resets city and category filters', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)

    const recentAlerts = [
      { ...alertHistory[0], data: 'תל אביב - מרכז העיר', alertDate: `${yesterdayStr}T10:00:00` },
      { ...alertHistory[1], data: 'ירושלים', alertDate: `${yesterdayStr}T11:30:00` },
    ]

    mockUseAlerts.mockReturnValue({
      alerts: recentAlerts,
      loading: false,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    // Select a city
    const cityInput = screen.getByPlaceholderText('הכל')
    fireEvent.focus(cityInput)
    fireEvent.change(cityInput, { target: { value: 'ירושלים' } })
    const option = screen.getByRole('option', { name: 'ירושלים' })
    fireEvent.mouseDown(option)

    // Select a category
    const categoryLabel = screen.getByText('סוג התרעה')
    const categorySelect = categoryLabel.closest('div')!.querySelector('select')!
    fireEvent.change(categorySelect, { target: { value: '1' } })

    // Switch language to English — this should reset city and category
    mockUseCities.mockReturnValue({
      cities,
      cityLabels: ['Tel Aviv - City Center', 'Jerusalem'],
      loading: false,
      error: null,
    })

    const langToggle = screen.getByRole('button', { name: /toggle language/i })
    fireEvent.click(langToggle)

    // After language switch: city input should be empty (placeholder shown)
    const cityInputAfter = screen.getByPlaceholderText('All')
    expect(cityInputAfter).toHaveValue('')

    // Category select should show "All"
    const categoryLabelAfter = screen.getByText('Alert type')
    const categorySelectAfter = categoryLabelAfter.closest('div')!.querySelector('select')!
    expect(categorySelectAfter).toHaveValue('')
  })

  // 9. Refresh button is NOT disabled when alertsLoading=true (only disabled when isRefreshing=true)
  it('refresh button is not disabled when alertsLoading=true (disabled only while isRefreshing)', () => {
    mockUseAlerts.mockReturnValue({
      alerts: [],
      loading: true,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    const refreshBtn = screen.getByRole('button', { name: /refresh data/i })
    // page.tsx: disabled={isRefreshing} — the button is only disabled after clicking refresh
    // (while the fetch is in flight). alertsLoading=true alone does not disable the button.
    expect(refreshBtn).toBeInTheDocument()
    expect(refreshBtn).not.toBeDisabled()
  })

  // 10. Refresh button disables itself after click (isRefreshing=true)
  it('refresh button is disabled while isRefreshing is true', () => {
    // Make loading stay true so isRefreshing doesn't auto-clear
    mockUseAlerts.mockReturnValue({
      alerts: [],
      loading: true,
      error: null,
      retry: mockRetry,
    })
    mockUseCityRankings.mockReturnValue({
      cities: [],
      loading: true,
      error: null,
      refetch: mockRankRefetch,
    })

    renderPage()

    const refreshBtn = screen.getByRole('button', { name: /refresh data/i })
    expect(refreshBtn).not.toBeDisabled()

    // Click refresh — sets isRefreshing=true
    fireEvent.click(refreshBtn)

    // Button should now be disabled (isRefreshing=true)
    expect(refreshBtn).toBeDisabled()
  })

  // 11. Refresh button triggers re-fetch
  it('refresh button calls retry and rankRefetch', () => {
    renderPage()

    const refreshBtn = screen.getByRole('button', { name: /refresh data/i })
    fireEvent.click(refreshBtn)

    expect(mockRetry).toHaveBeenCalledTimes(1)
    expect(mockRankRefetch).toHaveBeenCalledTimes(1)
  })

  // 11b. Refresh button calls tzevaadomRefetch when in custom (tzevaadom) mode
  it('refresh button calls tzevaadomRefetch when in custom date range mode', () => {
    renderPage()

    // Switch to custom date range — this sets isCustom=true which makes useTzevaadom=true
    const dateRangeSelect = screen.getByDisplayValue('24 שעות אחרונות')
    fireEvent.change(dateRangeSelect, { target: { value: 'custom' } })

    // Enter valid custom dates so the page is in a meaningful state
    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-03-07' } })

    // Clear call counts from state-change re-renders
    mockTzevaadomRefetch.mockClear()
    mockRankRefetch.mockClear()
    mockRetry.mockClear()

    // Click refresh — handleRefresh calls tzevaadomRefetch() because useTzevaadom=true
    const refreshBtn = screen.getByRole('button', { name: /refresh data/i })
    fireEvent.click(refreshBtn)

    expect(mockTzevaadomRefetch).toHaveBeenCalledTimes(1)
    expect(mockRankRefetch).toHaveBeenCalledTimes(1)
  })

  // 12. "Last 24 hours · All cities" subtitle visible on charts
  it('"Last 24 hours · כל הערים" subtitle visible on charts', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)

    mockUseAlerts.mockReturnValue({
      alerts: [{ ...alertHistory[0], alertDate: `${yesterdayStr}T10:00:00` }],
      loading: false,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    // The chart subtitle combines range label + city part
    // In Hebrew mode: '24 שעות אחרונות · כל הערים'
    const subtitles = screen.getAllByText(/24 שעות אחרונות · כל הערים/)
    expect(subtitles.length).toBeGreaterThanOrEqual(1)
  })

  // 13. City name in subtitle when city is selected
  it('subtitle shows selected city name', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)

    mockUseAlerts.mockReturnValue({
      alerts: [{ ...alertHistory[0], data: 'ירושלים', alertDate: `${yesterdayStr}T10:00:00` }],
      loading: false,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    // Select Jerusalem from the city combobox
    const cityInput = screen.getByPlaceholderText('הכל')
    fireEvent.focus(cityInput)
    fireEvent.change(cityInput, { target: { value: 'ירושלים' } })
    const option = screen.getByRole('option', { name: 'ירושלים' })
    fireEvent.mouseDown(option)

    // Subtitle should now contain 'ירושלים'
    const subtitles = screen.getAllByText(/ירושלים/)
    // At least one subtitle element should contain the city name
    const hasSubtitleWithCity = subtitles.some((el) =>
      el.textContent?.includes('שעות') && el.textContent?.includes('ירושלים')
    )
    expect(hasSubtitleWithCity).toBe(true)
  })

  // 14. Custom date range shows date subtitle
  it('custom date range subtitle shows DD/MM/YYYY – DD/MM/YYYY', () => {
    mockUseTzevaadomAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
      refetch: mockTzevaadomRefetch,
    })

    renderPage()

    // Switch to custom
    const dateRangeSelect = screen.getByDisplayValue('24 שעות אחרונות')
    fireEvent.change(dateRangeSelect, { target: { value: 'custom' } })

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-03-07' } })

    // Subtitle should show '01/03/2026 – 07/03/2026' (formatDate produces DD/MM/YYYY)
    const subtitles = screen.getAllByText(/01\/03\/2026 – 07\/03\/2026/)
    expect(subtitles.length).toBeGreaterThanOrEqual(1)
  })

  // 15. Loading spinner shown while data loads
  it('shows loading spinner when alertsLoading is true', () => {
    mockUseAlerts.mockReturnValue({
      alerts: [],
      loading: true,
      error: null,
      retry: mockRetry,
    })

    renderPage()

    // The loading text is shown: "טוען..." in Hebrew
    const loadingTexts = screen.getAllByText('טוען...')
    expect(loadingTexts.length).toBeGreaterThan(0)
  })

  // 16. Tab bar — switching to Map tab renders MapView
  it('switches to map tab when Map button is clicked', async () => {
    renderPage()

    // Find the Map tab button — in Hebrew (default locale) tabMap = 'מפה'
    const mapTabButton = screen.getByRole('button', { name: /מפה/i })
    await userEvent.click(mapTabButton)

    expect(screen.getByTestId('map-view')).toBeInTheDocument()
  })

  // 17. Error state shows retry button
  it('error state shows retry button for non-custom ranges', () => {
    mockUseAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: 'Network error',
      retry: mockRetry,
    })

    renderPage()

    // Error message is shown
    expect(screen.getByText('שגיאה בטעינת הנתונים')).toBeInTheDocument()

    // Retry button is shown (for non-custom ranges)
    expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeInTheDocument()
  })
})

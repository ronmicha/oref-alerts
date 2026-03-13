import { fetchAlertHistory, fetchCities, fetchCategories } from '../oref'
import { fetchTzevaadomRaw } from '../tzevaadom'

beforeAll(() => {
  // jsdom does not define fetch on global; we must define it so jest.spyOn can replace it
  if (!('fetch' in global)) {
    ;(global as unknown as Record<string, unknown>).fetch = () => Promise.resolve()
  }
})

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('fetchAlertHistory API payload snapshots', () => {
  function mockHistoryFetch() {
    return jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('[]'),
      } as Response)
    )
  }

  it('mode=1, lang=he', async () => {
    const fetchSpy = mockHistoryFetch()
    await fetchAlertHistory({ mode: 1, lang: 'he' })
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })

  it('mode=2, lang=he', async () => {
    const fetchSpy = mockHistoryFetch()
    await fetchAlertHistory({ mode: 2, lang: 'he' })
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })

  it('mode=3, lang=en', async () => {
    const fetchSpy = mockHistoryFetch()
    await fetchAlertHistory({ mode: 3, lang: 'en' })
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })

  it('mode=1, lang=he, city=תל אביב', async () => {
    const fetchSpy = mockHistoryFetch()
    await fetchAlertHistory({ mode: 1, lang: 'he', city: 'תל אביב' })
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })

  it('mode=0, fromDate=01.03.2026, toDate=12.03.2026', async () => {
    const fetchSpy = mockHistoryFetch()
    await fetchAlertHistory({ mode: 0, fromDate: '01.03.2026', toDate: '12.03.2026' })
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })
})

describe('fetchCities API payload snapshots', () => {
  function mockJsonFetch() {
    return jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    )
  }

  it('lang=he', async () => {
    const fetchSpy = mockJsonFetch()
    await fetchCities('he')
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })

  it('lang=en', async () => {
    const fetchSpy = mockJsonFetch()
    await fetchCities('en')
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })
})

describe('fetchCategories API payload snapshots', () => {
  it('no params', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    )
    await fetchCategories()
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })
})

describe('fetchTzevaadomRaw API payload snapshots', () => {
  it('no params', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    )
    await fetchTzevaadomRaw()
    expect(fetchSpy.mock.calls[0][0]).toMatchSnapshot()
  })
})

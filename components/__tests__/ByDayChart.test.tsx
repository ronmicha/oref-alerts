import React from 'react'
import { render, screen } from '@testing-library/react'
import { ByDayChart } from '../ByDayChart'
import { I18nProvider } from '@/lib/i18n'
import { categories } from '@/tests/fixtures/categories'
import type { DayCount } from '@/types/oref'

// Mock recharts so the chart renders in jsdom.
// BarChart collects Bar children's `name` props and passes them as payload to Legend.
// This lets us verify Legend formatter output without real DOM dimensions.
jest.mock('recharts', () => {
  const React = require('react')

  function MockLegend({ payload, formatter }: {
    payload?: Array<{ value: string }>
    formatter?: (value: string) => React.ReactNode
  }) {
    if (!payload || !formatter) return null
    return (
      <div data-testid="legend">
        {payload.map((entry) => (
          <span key={entry.value}>{formatter(entry.value)}</span>
        ))}
      </div>
    )
  }

  function MockBarChart({ children }: { children: React.ReactNode }) {
    // Collect Bar names to build legend payload, then render Legend with payload
    const childArray = React.Children.toArray(children)
    const barNames: string[] = []
    childArray.forEach((child: unknown) => {
      const c = child as React.ReactElement<{ name?: string }>
      if (c && c.props && c.props.name) {
        barNames.push(c.props.name)
      }
    })
    const payload = barNames.map((name) => ({ value: name }))

    return (
      <div data-testid="barchart">
        {childArray.map((child: unknown) => {
          const c = child as React.ReactElement
          if (c && c.type === MockLegend) {
            return React.cloneElement(c, { payload } as object)
          }
          return c
        })}
      </div>
    )
  }

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    BarChart: MockBarChart,
    Bar: ({ name }: { name: string }) => <div data-testid={`bar-${name}`} />,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: MockLegend,
    ReferenceLine: () => null,
  }
})

// I18nProvider defaults to Hebrew ('he') — category names from he.json categories

function renderChart(props: { data: DayCount[]; categories: typeof categories }) {
  return render(
    <I18nProvider>
      <ByDayChart {...props} />
    </I18nProvider>
  )
}

describe('ByDayChart', () => {
  it('renders without crashing with data=[]', () => {
    renderChart({ data: [], categories })
    expect(screen.getByTestId('barchart')).toBeInTheDocument()
  })

  it('renders one legend item per active category', () => {
    // Data includes both categories (id 1 and 2)
    const data: DayCount[] = [
      {
        dateKey: '2024-01-01',
        label: '01/01',
        dayName: 'Mon',
        count: 5,
        byCategory: { 1: 3, 2: 2 },
      },
    ]
    renderChart({ data, categories })

    // Legend renders one item per activeCatId (one per category in data)
    // He translations: missilealert → "ירי רקטות וטילים", uav → "חדירת כלי טיס עוין"
    expect(screen.getByText('ירי רקטות וטילים')).toBeInTheDocument()
    expect(screen.getByText('חדירת כלי טיס עוין')).toBeInTheDocument()
  })

  it('renders one bar group per category', () => {
    // Data includes both categories (id 1 and 2)
    const data: DayCount[] = [
      {
        dateKey: '2024-01-01',
        label: '01/01',
        dayName: 'Mon',
        count: 5,
        byCategory: { 1: 3, 2: 2 },
      },
    ]
    renderChart({ data, categories })

    // The mock renders data-testid="bar-{name}" for each <Bar />.
    // There should be one Bar per active category (2 in this dataset).
    const barElements = screen.getAllByTestId(/^bar-/)
    expect(barElements).toHaveLength(2)
  })

  it('legend renders each category translated name', () => {
    const data: DayCount[] = [
      {
        dateKey: '2024-01-01',
        label: '01/01',
        dayName: 'Mon',
        count: 3,
        byCategory: { 1: 3 },
      },
      {
        dateKey: '2024-01-02',
        label: '02/01',
        dayName: 'Tue',
        count: 2,
        byCategory: { 2: 2 },
      },
    ]
    renderChart({ data, categories })

    // Both categories appear as translated names in the legend
    // He: missilealert → "ירי רקטות וטילים", uav → "חדירת כלי טיס עוין"
    expect(screen.getByText('ירי רקטות וטילים')).toBeInTheDocument()
    expect(screen.getByText('חדירת כלי טיס עוין')).toBeInTheDocument()
  })
})

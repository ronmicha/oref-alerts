import React from 'react'
import { render, screen } from '@testing-library/react'
import { TimeOfDayChart } from '../TimeOfDayChart'
import { I18nProvider } from '@/lib/i18n'
import { categories } from '@/tests/fixtures/categories'
import type { TimeSlotCount } from '@/types/oref'

// Mock recharts so the chart renders in jsdom.
// BarChart collects Bar children's `name` props and passes them as payload to Legend.
// ReferenceLine renders its `label` prop so we can check todayLabel/yesterdayLabel.
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

  function MockReferenceLine({ label }: { label?: React.ReactNode }) {
    if (!label) return null
    // Render the label element so we can detect todayLabel/yesterdayLabel in the DOM
    return <div data-testid="reference-line">{label}</div>
  }

  function MockBarChart({ children }: { children: React.ReactNode }) {
    const childArray = React.Children.toArray(children)
    const barNames: string[] = []
    childArray.forEach((child: unknown) => {
      const c = child as React.ReactElement
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
    ReferenceLine: MockReferenceLine,
  }
})

// I18nProvider defaults to Hebrew ('he') — strings from he.json

// Generate 96 empty time slots (00:00 to 23:45 in 15-min intervals)
const emptySlots: TimeSlotCount[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return {
    timeKey: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    count: 0,
    byCategory: {},
  }
})

function renderChart(props: {
  data: TimeSlotCount[]
  categories: typeof categories
  showNowLabels?: boolean
}) {
  return render(
    <I18nProvider>
      <TimeOfDayChart {...props} />
    </I18nProvider>
  )
}

describe('TimeOfDayChart', () => {
  it('renders without crashing with 96 empty slots', () => {
    renderChart({ data: emptySlots, categories })
    expect(screen.getByTestId('barchart')).toBeInTheDocument()
  })

  it('legend renders each category translated name', () => {
    // Include data with both categories so the legend shows their names
    const dataWithCategories: TimeSlotCount[] = emptySlots.map((slot, i) =>
      i === 0
        ? { ...slot, count: 3, byCategory: { 1: 2, 2: 1 } }
        : slot
    )
    renderChart({ data: dataWithCategories, categories })

    // He translations: missilealert → "ירי רקטות וטילים", uav → "חדירת כלי טיס עוין"
    expect(screen.getByText('ירי רקטות וטילים')).toBeInTheDocument()
    expect(screen.getByText('חדירת כלי טיס עוין')).toBeInTheDocument()
  })

  it('"Today" / "Yesterday" labels absent when showNowLabels=false', () => {
    renderChart({ data: emptySlots, categories, showNowLabels: false })

    // He translations: todayLabel → "היום", yesterdayLabel → "אתמול"
    // ReferenceLine always renders but label prop is undefined when showNowLabels=false
    expect(screen.queryByText('היום')).toBeNull()
    expect(screen.queryByText('אתמול')).toBeNull()
  })
})

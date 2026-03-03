'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { DayCount, AlertCategory } from '@/types/oref'
import { useI18n } from '@/lib/i18n'

// Fixed color palette — assigned to categories in the order they appear
const COLORS = [
  '#EF4444', '#F97316', '#3B82F6', '#10B981',
  '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899',
  '#84CC16', '#6B7280',
]

interface AlertChartProps {
  data: DayCount[]
  categories: AlertCategory[]
}

function CustomTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload) return null
  const [dayName, dateLabel] = payload.value.split('|')
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#6B7280" fontSize={11}>
        {dayName}
      </text>
      <text x={0} y={0} dy={28} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
        {dateLabel}
      </text>
    </g>
  )
}

export function AlertChart({ data, categories }: AlertChartProps) {
  const { lang, tCategory } = useI18n()

  // RTL: reverse so newest date is on the left, oldest on the right
  const orderedData = lang === 'he' ? [...data].reverse() : data

  // Find which category IDs actually appear in this data slice
  const activeCatIds = [...new Set(
    orderedData.flatMap((d) => Object.keys(d.byCategory).map(Number))
  )]

  // Build chart data: flatten byCategory into cat_<id> keys for Recharts
  const chartData = orderedData.map((d) => {
    const flat: Record<string, unknown> = {
      ...d,
      xKey: `${d.dayName}|${d.label}`,
    }
    for (const id of activeCatIds) {
      flat[`cat_${id}`] = d.byCategory[id] ?? 0
    }
    return flat
  })

  // Map category id → translated name (for tooltip + legend)
  const catName = (id: number) => {
    const cat = categories.find((c) => c.id === id)
    return cat ? tCategory(cat.category) : String(id)
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="xKey"
          tick={<CustomTick />}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          width={32}
        />
        <Tooltip
          cursor={{ fill: '#F3F4F6' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as DayCount & { xKey: string }
            const entries = activeCatIds
              .map((id) => ({ name: catName(id), count: d.byCategory[id] ?? 0 }))
              .filter((e) => e.count > 0)
            return (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow text-sm min-w-[140px]">
                <div className="font-medium text-gray-700 mb-1">{d.dayName} {d.label}</div>
                {entries.map((e, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <span className="text-gray-600">{e.name}</span>
                    <span className="font-bold" style={{ color: COLORS[i % COLORS.length] }}>{e.count}</span>
                  </div>
                ))}
                <div className="mt-1 pt-1 border-t border-gray-100 flex justify-between font-semibold text-gray-800">
                  <span>סה״כ</span>
                  <span>{d.count}</span>
                </div>
              </div>
            )
          }}
        />
        <Legend
          formatter={(value) => {
            const id = Number(String(value).replace('cat_', ''))
            return <span style={{ fontSize: 12, color: '#374151', marginLeft: 4 }}>{catName(id)}</span>
          }}
          wrapperStyle={{ paddingTop: 24 }}
        />
        {activeCatIds.map((id, i) => (
          <Bar
            key={id}
            dataKey={`cat_${id}`}
            stackId="stack"
            fill={COLORS[i % COLORS.length]}
            radius={i === activeCatIds.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={40}
            name={`cat_${id}`}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

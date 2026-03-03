'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { DayCount } from '@/types/oref'
import { useI18n } from '@/lib/i18n'

interface AlertChartProps {
  data: DayCount[]
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

export function AlertChart({ data }: AlertChartProps) {
  const { lang } = useI18n()

  // RTL: reverse so newest date is on the left, oldest on the right
  const orderedData = lang === 'he' ? [...data].reverse() : data

  const chartData = orderedData.map((d) => ({
    ...d,
    // Encode both day name and date into the x-axis key, decoded by CustomTick
    xKey: `${d.dayName}|${d.label}`,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
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
            return (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow text-sm">
                <div className="font-medium text-gray-800">{d.dayName} {d.label}</div>
                <div className="text-blue-600 font-bold">{d.count}</div>
              </div>
            )
          }}
        />
        <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

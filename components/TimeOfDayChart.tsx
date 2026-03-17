'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { TimeSlotCount, AlertCategory } from '@/types/oref'
import { useI18n } from '@/lib/i18n'
import { getCategoryColor } from '@/lib/chartColors'

interface TimeOfDayChartProps {
  data: TimeSlotCount[]
  categories: AlertCategory[]
  showNowLabels?: boolean
}

// Only render y-axis labels on the hour (HH:00)
function TimeAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!payload || !payload.value.endsWith(':00')) return <g />
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-4} y={0} dy={4} textAnchor="end" fill="#9CA3AF" fontSize={10}>
        {payload.value}
      </text>
    </g>
  )
}

interface NowLabelProps {
  viewBox?: { x: number; y: number; width: number; height: number }
  todayLabel?: string
  yesterdayLabel?: string
}

function NowLabel({ viewBox, todayLabel, yesterdayLabel }: NowLabelProps) {
  if (!viewBox) return null
  const { x, y, width } = viewBox
  const iconSize = 13
  // Anchor group just outside the right edge of the plot area
  const iconX = x + width - 6
  const textX = iconX + iconSize + 4
  const todayY = y - 9
  const yestY  = y + 17

  return (
    <g>
      <g transform={`translate(${iconX}, ${todayY - 10})`}>
        <ArrowUp size={iconSize} color="#9CA3AF" strokeWidth={2.5} />
      </g>
      <text x={textX} y={todayY} fontSize={10} fontWeight={600} fill="#9CA3AF" textAnchor="start">
        {todayLabel}
      </text>
      <g transform={`translate(${iconX}, ${yestY - 10})`}>
        <ArrowDown size={iconSize} color="#9CA3AF" strokeWidth={2.5} />
      </g>
      <text x={textX} y={yestY} fontSize={10} fontWeight={600} fill="#9CA3AF" textAnchor="start">
        {yesterdayLabel}
      </text>
    </g>
  )
}

function getNowSlot(): string {
  const now = new Date()
  const h = now.getHours()
  const m = Math.floor(now.getMinutes() / 15) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function TimeOfDayChart({ data, categories, showNowLabels }: TimeOfDayChartProps) {
  const { t, tCategory } = useI18n()

  const nowSlot = getNowSlot()

  const activeCatIds = [...new Set(
    data.flatMap((d) => Object.keys(d.byCategory).map(Number))
  )]

  const chartData = data.map((d) => {
    const flat: Record<string, unknown> = { ...d }
    for (const id of activeCatIds) flat[`cat_${id}`] = d.byCategory[id] ?? 0
    return flat
  })

  const catName = (id: number) => {
    const cat = categories.find((c) => c.id === id)
    return cat ? tCategory(cat.category) : String(id)
  }

  return (
    <ResponsiveContainer width="100%" height={700}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: showNowLabels ? 60 : 16, left: 0, bottom: 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <YAxis
          type="category"
          dataKey="timeKey"
          tick={<TimeAxisTick />}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
          interval={0}
          width={48}
        />
        <Tooltip
          cursor={{ fill: '#F3F4F6' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as TimeSlotCount
            const entries = activeCatIds
              .map((id) => ({ name: catName(id), count: d.byCategory[id] ?? 0, id }))
              .filter((e) => e.count > 0)
            return (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow text-sm min-w-[140px]">
                <div className="font-medium text-gray-700 mb-1">{d.timeKey}</div>
                {entries.map((e) => (
                  <div key={e.id} className="flex justify-between gap-4">
                    <span className="text-gray-600">{e.name}</span>
                    <span className="font-bold" style={{ color: getCategoryColor(categories, e.id) }}>{e.count}</span>
                  </div>
                ))}
                <div className="mt-1 pt-1 border-t border-gray-100 flex justify-between font-semibold text-gray-800">
                  <span>{t('total')}</span>
                  <span>{d.count}</span>
                </div>
              </div>
            )
          }}
        />
        <Legend
          formatter={(value) => {
            const id = Number(String(value).replace('cat_', ''))
            return <span style={{ fontSize: 12, color: '#374151', margin: '0 6px' }}>{catName(id)}</span>
          }}
          wrapperStyle={{ paddingTop: 8 }}
        />
        {activeCatIds.map((id, i) => (
          <Bar
            key={id}
            dataKey={`cat_${id}`}
            stackId="stack"
            fill={getCategoryColor(categories, id, i)}
            radius={i === activeCatIds.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
            maxBarSize={6}
            name={`cat_${id}`}
            tabIndex={-1}
          />
        ))}
        <ReferenceLine
          y={nowSlot}
          stroke="#9CA3AF"
          strokeDasharray="5 3"
          strokeWidth={1.5}
          label={showNowLabels ? <NowLabel todayLabel={t('todayLabel')} yesterdayLabel={t('yesterdayLabel')} /> : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

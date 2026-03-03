'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import type { AlertCategory, DateRangeOption } from '@/types/oref'

interface CityComboboxProps {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}

function CityCombobox({ value, onChange, options, placeholder }: CityComboboxProps) {
  const [input, setInput] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync input when the selected value changes externally
  useEffect(() => { setInput(value) }, [value])

  const matches = options
    .filter((o) => !input || o.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 100)

  // Close dropdown and revert if user clicks outside without selecting
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        if (input && !options.includes(input)) setInput(value)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [input, value, options])

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={input}
        placeholder={placeholder}
        className={inputClass}
        onChange={(e) => {
          setInput(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-50 w-full max-h-52 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg mt-1 text-sm">
          {matches.map((opt) => (
            <li
              key={opt}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-700"
              onMouseDown={(e) => {
                e.preventDefault() // keep input focused until selection completes
                setInput(opt)
                onChange(opt)
                setOpen(false)
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface FilterBarProps {
  dateRange: DateRangeOption
  onDateRangeChange: (v: DateRangeOption) => void
  cityLabel: string
  onCityLabelChange: (v: string) => void
  categoryId: number | undefined
  onCategoryIdChange: (v: number | undefined) => void
  cityLabels: string[]
  categories: AlertCategory[]
}

export function FilterBar({
  dateRange, onDateRangeChange,
  cityLabel, onCityLabelChange,
  categoryId, onCategoryIdChange,
  cityLabels, categories,
}: FilterBarProps) {
  const { t, tCategory } = useI18n()

  const selectClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="flex flex-wrap gap-4">
      {/* Date range */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterDateRange')}
        </label>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
          className={selectClass}
        >
          <option value="today">{t('today')}</option>
          <option value="7d">{t('last7days')}</option>
          <option value="14d">{t('last14days')}</option>
          <option value="30d">{t('last30days')}</option>
        </select>
      </div>

      {/* City */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterCity')}
        </label>
        <CityCombobox
          value={cityLabel}
          onChange={onCityLabelChange}
          options={cityLabels}
          placeholder={t('all')}
        />
      </div>

      {/* Category */}
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('filterCategory')}
        </label>
        <select
          value={categoryId ?? ''}
          onChange={(e) =>
            onCategoryIdChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
          className={selectClass}
        >
          <option value="">{t('all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{tCategory(c.category)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

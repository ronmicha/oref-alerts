'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { useI18n } from '@/lib/i18n'
import type { AlertCategory, DateRangeOption } from '@/types/oref'

interface CityComboboxProps {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}

export function CityCombobox({ value, onChange, options, placeholder }: CityComboboxProps) {
  const [input, setInput] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const uid = useId()

  // Sync input when the selected value changes externally
  useEffect(() => { setInput(value) }, [value])

  const matches = options
    .filter((o) => !input || o.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 100)

  // Reset highlight when the match list changes (new search term)
  useEffect(() => { setHighlightedIndex(-1) }, [matches.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

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

  function select(opt: string) {
    setInput(opt)
    onChange(opt)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      select(matches[highlightedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      if (input && !options.includes(input)) setInput(value)
    }
  }

  const inputClass =
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]'

  const listId = `${uid}-list`

  function clear() {
    setInput('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={highlightedIndex >= 0 ? `${uid}-opt-${highlightedIndex}` : undefined}
        value={input}
        placeholder={placeholder}
        className={`${inputClass}${input ? ' pe-8' : ''}`}
        onChange={(e) => {
          setInput(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {input && (
        <button
          type="button"
          aria-label="Clear"
          onMouseDown={(e) => { e.preventDefault(); clear() }}
          className="absolute inset-y-0 end-0 flex items-center px-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          ✕
        </button>
      )}
      {open && matches.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 w-full max-h-52 overflow-auto rounded-lg border bg-white shadow-lg mt-1 text-sm border-[var(--color-border)]"
        >
          {matches.map((opt, i) => (
            <li
              key={opt}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === highlightedIndex}
              className={`px-3 py-2 cursor-pointer text-[var(--color-text)] ${i === highlightedIndex ? 'bg-red-50 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg)]'}`}
              onMouseDown={(e) => {
                e.preventDefault() // keep input focused until selection completes
                select(opt)
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
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
  customFrom: string
  onCustomFromChange: (v: string) => void
  customTo: string
  onCustomToChange: (v: string) => void
}

export function FilterBar({
  dateRange, onDateRangeChange,
  cityLabel, onCityLabelChange,
  categoryId, onCategoryIdChange,
  cityLabels, categories,
  customFrom, onCustomFromChange,
  customTo, onCustomToChange,
}: FilterBarProps) {
  const { t, tCategory } = useI18n()

  const selectClass =
    'block w-full rounded-lg border bg-white ps-3 pe-8 py-2 text-sm focus:outline-none focus:ring-1' +
    ' border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]' +
    ' text-[var(--color-text)]'

  return (
    <div className="flex flex-wrap gap-4">
      {/* Date range + custom date pickers (stacked vertically) */}
      <div className="flex-1 min-w-[160px] flex flex-col gap-2">
        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase text-[var(--color-text-muted)]">
            {t('filterDateRange')}
          </label>
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
            className={selectClass}
          >
            <option value="today">{t('today')}</option>
            <option value="7d">{t('last7days')}</option>
            <option value="30d">{t('last30days')}</option>
            <option value="custom">{t('custom')}</option>
          </select>
        </div>
        {dateRange === 'custom' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase text-[var(--color-text-muted)]">
                {t('filterFromDate')}
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => onCustomFromChange(e.target.value)}
                className={`${selectClass}${customFrom ? '' : ' text-transparent'}`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase text-[var(--color-text-muted)]">
                {t('filterToDate')}
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => onCustomToChange(e.target.value)}
                className={`${selectClass}${customTo ? '' : ' text-transparent'}`}
              />
            </div>
          </div>
        )}
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

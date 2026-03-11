# City Comparison Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to select multiple cities in CityRankingChart and compare their ranks and alert counts in the table.

**Architecture:** All state lives inside `CityRankingChart`. The existing `CityCombobox` is reused by always passing `value=""` so it auto-clears after each selection. Selected cities are stored as `string[]`, rendered as deleteable chips below the combobox, and shown as table rows sorted by alert count descending.

**Tech Stack:** React (useState, useMemo), existing CityCombobox, existing rankMap logic, Tailwind utility classes, CSS-in-JS inline styles matching the existing component patterns.

---

### Task 1: Replace single-city state with multi-city array

**Files:**
- Modify: `components/CityRankingChart.tsx`

**Step 1: Replace the state declaration**

In `CityRankingChart`, find:
```tsx
const [cityLabel, setCityLabel] = useState('')
```
Replace with:
```tsx
const [selectedCities, setSelectedCities] = useState<string[]>([])
```

**Step 2: Add handler functions** (add immediately below the new state line)

```tsx
const addCity = (label: string) => {
  if (label && !selectedCities.includes(label)) {
    setSelectedCities((prev) => [...prev, label])
  }
}
const removeCity = (label: string) => {
  setSelectedCities((prev) => prev.filter((c) => c !== label))
}
```

**Step 3: Run build to verify no TypeScript errors so far**

```bash
npm run build
```
Expected: build fails (cityLabel is still referenced elsewhere — that's fine, we fix it in the next tasks)

---

### Task 2: Update the combobox wiring

**Files:**
- Modify: `components/CityRankingChart.tsx`

**Step 1: Update the CityCombobox JSX**

Find:
```tsx
<CityCombobox
  value={cityLabel}
  onChange={setCityLabel}
  options={cityLabels}
  placeholder={t('all')}
/>
```
Replace with:
```tsx
<CityCombobox
  value=""
  onChange={addCity}
  options={cityLabels.filter((l) => !selectedCities.includes(l))}
  placeholder={t('all')}
/>
```

`value=""` ensures the input clears after every selection (CityCombobox syncs its internal input from the `value` prop via a `useEffect`). Already-selected cities are removed from the dropdown so they can't be added twice.

**Step 2: Run build — still expect errors from remaining `cityLabel` references**

```bash
npm run build
```

---

### Task 3: Render chips below the combobox

**Files:**
- Modify: `components/CityRankingChart.tsx`

**Step 1: Add chip list JSX** — directly after the closing `</div>` of the `CityCombobox` wrapper div:

```tsx
{selectedCities.length > 0 && (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
    {selectedCities.map((label) => (
      <span
        key={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.5rem',
          borderRadius: 999,
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        {label}
        <button
          onClick={() => removeCity(label)}
          aria-label={`Remove ${label}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--color-text-muted)',
            lineHeight: 1,
            fontSize: '0.85rem',
          }}
        >
          ×
        </button>
      </span>
    ))}
  </div>
)}
```

**Step 2: Run build — still expect errors from `cityLabel` in table logic**

```bash
npm run build
```

---

### Task 4: Update table data logic

**Files:**
- Modify: `components/CityRankingChart.tsx`

**Step 1: Replace `sortedSliced` computation**

Find the entire `sortedSliced` block:
```tsx
const sortedSliced = cityLabel
  ? (() => {
      const found = withAlerts.filter((c) => c.label === cityLabel)
      return found.length > 0 ? found : [{ label: cityLabel, count: 0 }]
    })()
  : [...withAlerts].sort((a, b) => {
      const countDiff = sortDesc ? b.count - a.count : a.count - b.count
      if (countDiff !== 0) return countDiff
      if (!sortDesc) return (rankMap.get(b.label) ?? 0) - (rankMap.get(a.label) ?? 0)
      return 0
    }).slice(0, 50)
```
Replace with:
```tsx
const sortedSliced = selectedCities.length > 0
  ? selectedCities
      .map((label) => withAlerts.find((c) => c.label === label) ?? { label, count: 0 })
      .sort((a, b) => b.count - a.count)
  : [...withAlerts].sort((a, b) => {
      const countDiff = sortDesc ? b.count - a.count : a.count - b.count
      if (countDiff !== 0) return countDiff
      if (!sortDesc) return (rankMap.get(b.label) ?? 0) - (rankMap.get(a.label) ?? 0)
      return 0
    }).slice(0, 50)
```

**Step 2: Update the subtitle / header info section**

Find:
```tsx
{!loading && cityLabel && (
  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
    {rankMap.has(cityLabel)
      ? t('cityRankSearchInfo', { rank: String(rankMap.get(cityLabel)), total: String(withAlerts.length) })
      : t('cityRankingNoAlerts')}
  </p>
)}
```
Replace with — hide subtitle entirely in compare mode (chips communicate context):
```tsx
{!loading && selectedCities.length === 0 && withAlerts.length > 50 && (
  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
    {sortDesc
      ? t('cityRankingTop', { n: '50', total: String(withAlerts.length) })
      : t('cityRankingBottom', { n: '50', total: String(withAlerts.length) })}
  </p>
)}
```

Also find the existing duplicate "top/bottom" subtitle block (the one that shows without `cityLabel`):
```tsx
{!loading && !cityLabel && withAlerts.length > 50 && (
```
Delete this entire block — the replacement above already covers it.

**Step 3: Hide sort button in compare mode**

Find the sort button condition in the `<th>`:
```tsx
{!cityLabel ? (
  <button ...>
```
Replace with:
```tsx
{selectedCities.length === 0 ? (
  <button ...>
```

**Step 4: Run build — should be clean now**

```bash
npm run build
```
Expected: ✓ Compiled successfully, TypeScript clean.

**Step 5: Manually verify in browser**
- Start dev server: `npm run dev`
- Open the City Ranking section
- Search for a city → it should appear as a chip, input clears, table shows only that city
- Search for another city → second chip added, table shows both sorted by alert count
- Click × on a chip → city removed, if all removed table reverts to top-50 list
- Already-selected cities should not appear in the dropdown

**Step 6: Commit**

```bash
git add components/CityRankingChart.tsx
git commit -m "feat: multi-city comparison in CityRankingChart"
```

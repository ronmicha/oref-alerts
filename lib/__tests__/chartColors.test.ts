import { getCategoryColor } from '../chartColors'
import { categories } from '@/tests/fixtures/categories'

describe('getCategoryColor', () => {
  it('returns a consistent color across multiple calls for a known category ID', () => {
    const color1 = getCategoryColor(categories, 1)
    const color2 = getCategoryColor(categories, 1)
    expect(color1).toBe(color2)
  })

  it('does not throw for unknown category ID and returns a string', () => {
    let color: string
    expect(() => {
      color = getCategoryColor(categories, 9999)
    }).not.toThrow()
    expect(typeof color!).toBe('string')
    expect(color!.length).toBeGreaterThan(0)
  })

  it('returns different colors for two different category IDs', () => {
    const color1 = getCategoryColor(categories, 1) // missilealert → '#E01515'
    const color2 = getCategoryColor(categories, 2) // uav → '#7A1010'
    expect(color1).not.toBe(color2)
  })
})

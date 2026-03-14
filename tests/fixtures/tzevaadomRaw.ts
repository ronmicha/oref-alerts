import type { TzevaadomEntry } from '@/lib/tzevaadom'

// Entries at different Unix timestamps to support date range testing.
// ts=1000: early — for "before fromTs" tests
// ts=2000: middle — within a typical test range
// ts=3000: late — for "after toTs" tests
//
// Codes used:
//   0  → missilealert (allowed)
//   5  → uav (allowed)
//   99 → unknown code (disallowed, should be filtered out)
//
// Includes the known problematic city name 'אשדוד -יא,יב,טו,יז,מרינה,סיט'
// (without trailing י) which must be normalised to 'אשדוד -יא,יב,טו,יז,מרינה,סיטי'.
export const tzevaadomRaw: TzevaadomEntry[] = [
  // ts=1000, code 0 (missilealert), 1 city
  [101, 0, ['תל אביב - מרכז העיר'], 1000],

  // ts=2000, code 5 (uav), 2 cities — includes the problematic Ashdod spelling
  [102, 5, ['ירושלים', 'אשדוד -יא,יב,טו,יז,מרינה,סיט'], 2000],

  // ts=3000, code 0 (missilealert), 1 city
  [103, 0, ['ירושלים'], 3000],

  // ts=2500, code 99 (disallowed) — should be ignored by parsers
  [104, 99, ['תל אביב - מרכז העיר'], 2500],
]

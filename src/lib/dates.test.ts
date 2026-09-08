import { describe, expect, it } from 'vitest'
import {
  addWeeksToKey,
  formatWeekRange,
  weekDayKeys,
  weekdayInitial,
  weekEndKey,
  weekStartKey,
} from './dates'

describe('weekStartKey', () => {
  it('returns the Monday of the week containing the key', () => {
    expect(weekStartKey('2026-08-06')).toBe('2026-08-03') // Thursday
  })

  it('is idempotent on a Monday', () => {
    expect(weekStartKey('2026-08-03')).toBe('2026-08-03')
  })

  it('keeps Sunday in the week started by the previous Monday', () => {
    expect(weekStartKey('2026-08-09')).toBe('2026-08-03')
  })

  it('crosses year boundaries', () => {
    expect(weekStartKey('2026-01-01')).toBe('2025-12-29')
  })
})

describe('weekEndKey', () => {
  it('returns the Sunday six days after the Monday', () => {
    expect(weekEndKey('2026-08-03')).toBe('2026-08-09')
  })

  it('crosses month boundaries', () => {
    expect(weekEndKey('2026-07-27')).toBe('2026-08-02')
  })
})

describe('addWeeksToKey', () => {
  it('steps forward one week', () => {
    expect(addWeeksToKey('2026-08-03', 1)).toBe('2026-08-10')
  })

  it('steps back one week', () => {
    expect(addWeeksToKey('2026-08-03', -1)).toBe('2026-07-27')
  })
})

describe('formatWeekRange', () => {
  it('formats Monday–Sunday in short Spanish dates', () => {
    expect(formatWeekRange('2026-07-27')).toBe('27 jul – 2 ago')
  })
})

describe('weekDayKeys', () => {
  it('returns the seven keys Monday to Sunday', () => {
    expect(weekDayKeys('2026-09-07')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ])
  })
})

describe('weekdayInitial', () => {
  it('uses the Spanish initials, X for Wednesday', () => {
    expect(weekDayKeys('2026-09-07').map(weekdayInitial)).toEqual([
      'L',
      'M',
      'X',
      'J',
      'V',
      'S',
      'D',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { getCurrentWeekRange, toDateString, yearOf } from './date'

describe('toDateString', () => {
  it('zero-pads single-digit month and day', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('formats a normal date', () => {
    expect(toDateString(new Date(2026, 8, 2))).toBe('2026-09-02')
  })
})

describe('getCurrentWeekRange', () => {
  it('anchors a Wednesday to its Monday-Sunday week', () => {
    // 2026-09-02 is a Wednesday
    const { start, end } = getCurrentWeekRange(new Date(2026, 8, 2))
    expect(start).toBe('2026-08-31')
    expect(end).toBe('2026-09-06')
  })

  it('anchors a Monday to itself as the start of the week', () => {
    const { start, end } = getCurrentWeekRange(new Date(2026, 8, 7))
    expect(start).toBe('2026-09-07')
    expect(end).toBe('2026-09-13')
  })

  it('anchors a Sunday to the Monday six days earlier, not the next week', () => {
    // 2026-09-06 is a Sunday
    const { start, end } = getCurrentWeekRange(new Date(2026, 8, 6))
    expect(start).toBe('2026-08-31')
    expect(end).toBe('2026-09-06')
  })

  it('handles a week that spans a year boundary', () => {
    // 2025-12-31 is a Wednesday; its week runs into January 2026
    const { start, end } = getCurrentWeekRange(new Date(2025, 11, 31))
    expect(start).toBe('2025-12-29')
    expect(end).toBe('2026-01-04')
  })
})

describe('yearOf', () => {
  it('extracts the year from a service_date string', () => {
    expect(yearOf('2026-09-02')).toBe(2026)
    expect(yearOf('2025-12-28')).toBe(2025)
  })
})

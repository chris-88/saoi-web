import { describe, expect, it } from 'vitest'
import type { CasePlan } from '@contracts/case-plan.ts'
import { currentMonth, monthLabel, planStateLine } from './plan'

const plan = (summary: Partial<CasePlan['summary']> = {}): CasePlan => ({
  planId: 'p1',
  title: 'A first home',
  editable: {
    targetDate: '2028-06',
    homePrice: 400000,
    monthlySaving: 1500,
    propertyKind: 'second_hand',
    firstTimeBuyer: true,
    buyingTogether: false,
  },
  summary: {
    keysOn: '2028-03',
    neededAtKeysEur: 48000,
    savedEur: 12000,
    progressLine: null,
    ...summary,
  },
  watched: [],
  updatedAt: '2026-11-12T10:00:00.000Z',
})

describe('plan', () => {
  it('says the keys month and saved of needed in one line', () => {
    expect(planStateLine(plan())).toBe('Keys March 2028 · €12,000 of €48,000 saved')
  })

  it('falls back to the date given, and leaves out what is not known', () => {
    expect(planStateLine(plan({ keysOn: null, savedEur: null }))).toBe('Keys June 2028')
  })

  it('formats months', () => {
    expect(monthLabel('2027-01')).toBe('January 2027')
    expect(currentMonth(new Date(2026, 10, 12))).toBe('2026-11')
  })
})

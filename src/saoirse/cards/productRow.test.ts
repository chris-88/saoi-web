import { describe, expect, it } from 'vitest'
import { groupRows, providerInitials, splitValue } from './productRow'

describe('providerInitials', () => {
  it.each([
    ['bunq Easy Savings', 'bunq', 'B'],
    ['MoCo Instant Access', 'moco', 'MoCo'],
    ['Bank of Ireland Fixed Term', 'boi', 'BoI'],
    ['Bank of Ireland Fixed Term', 'bank-of-ireland', 'BoI'],
    ['State Savings Deposit Account', 'state-savings', 'SS'],
    ['AIB Online Saver', 'aib', 'AIB'],
    ['Your BoI savings', 'boi', 'BoI'],
    ['Avant Money', 'avant', 'A'],
  ])('%s (%s) is %s', (lead, providerId, initials) => {
    expect(providerInitials(lead, providerId)).toBe(initials)
  })

  it('falls back to the id when the lead does not spell it', () => {
    expect(providerInitials('Instalment Savings', 'an-post')).toBe('AP')
    expect(providerInitials('Fixed Term', 'ptsb')).toBe('PTSB')
    expect(providerInitials('Easy Saver', 'revolut')).toBe('R')
  })

  it('falls back to the lead without an id', () => {
    expect(providerInitials('Your BoI savings', undefined)).toBe('BoI')
    expect(providerInitials('bunq Easy Savings', undefined)).toBe('B')
    expect(providerInitials('', undefined)).toBe('')
  })
})

describe('splitValue', () => {
  it('splits a leading figure from its period', () => {
    expect(splitValue('3.11% to 1 Jan')).toEqual({ value: '3.11%', period: 'to 1 Jan' })
    expect(splitValue('4.00% for 12 months')).toEqual({ value: '4.00%', period: 'for 12 months' })
  })

  it('leaves a value with no period whole', () => {
    expect(splitValue('2.51%')).toEqual({ value: '2.51%', period: null })
    expect(splitValue('€1,751/mo')).toEqual({ value: '€1,751/mo', period: null })
    expect(splitValue('up to 3%')).toEqual({ value: 'up to 3%', period: null })
  })
})

describe('groupRows', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'held:0' }]
  const ids = (sections: ReturnType<typeof groupRows>) =>
    sections.map((section) => [section.label, section.rows.map((row) => row.id)])

  it('is one unlabelled list without groups', () => {
    expect(ids(groupRows(rows, undefined))).toEqual([[null, ['a', 'b', 'c', 'held:0']]])
    expect(ids(groupRows(rows, []))).toEqual([[null, ['a', 'b', 'c', 'held:0']]])
  })

  it('follows the groups and their own order, the rest after', () => {
    const groups = [
      { label: 'Yours', rowIds: ['held:0'] },
      { label: 'The market', rowIds: ['c', 'a'] },
    ]
    expect(ids(groupRows(rows, groups))).toEqual([
      ['Yours', ['held:0']],
      ['The market', ['c', 'a']],
      [null, ['b']],
    ])
  })

  it('skips unknown ids, a second mention, and a group left empty', () => {
    const groups = [
      { label: 'One', rowIds: ['a', 'zzz', 'b'] },
      { label: 'Two', rowIds: ['b'] },
      { label: 'Three', rowIds: ['c', 'held:0'] },
    ]
    expect(ids(groupRows(rows, groups))).toEqual([
      ['One', ['a', 'b']],
      ['Three', ['c', 'held:0']],
    ])
  })
})

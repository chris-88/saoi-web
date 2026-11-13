import { beforeEach, describe, expect, it } from 'vitest'
import { selectionForTurn, useProductSelection } from '@/saoirse/productSelection'

const product = (rowId: string, cardMessageId = 'card-1') => ({
  rowId,
  lead: `Lead of ${rowId}`,
  cardMessageId,
})

const ids = (): string[] => useProductSelection.getState().selected.map((item) => item.rowId)

beforeEach(() => {
  useProductSelection.getState().clear()
})

describe('the products selected to compare', () => {
  it('adds and takes out, in the order selected', () => {
    const { toggle } = useProductSelection.getState()
    expect(toggle(product('a'))).toBe('added')
    expect(toggle(product('b'))).toBe('added')
    expect(ids()).toEqual(['a', 'b'])
    expect(toggle(product('a'))).toBe('removed')
    expect(ids()).toEqual(['b'])
  })

  it('holds three at most, and notes the refusal on the card it came from', () => {
    const { toggle } = useProductSelection.getState()
    toggle(product('a'))
    toggle(product('b'))
    toggle(product('c'))
    expect(toggle(product('d', 'card-2'))).toBe('refused')
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(useProductSelection.getState().refusedOn).toBe('card-2')

    // Taking one out clears the note and makes room.
    expect(toggle(product('b'))).toBe('removed')
    expect(useProductSelection.getState().refusedOn).toBeNull()
    expect(toggle(product('d', 'card-2'))).toBe('added')
    expect(ids()).toEqual(['a', 'c', 'd'])
  })

  it('counts a product once whichever card it is tapped on', () => {
    const { toggle } = useProductSelection.getState()
    toggle(product('a', 'card-1'))
    expect(toggle(product('a', 'card-2'))).toBe('removed')
    expect(ids()).toEqual([])
  })

  it('takes out only the products a turn sent, keeping any selected since', () => {
    const { toggle, remove } = useProductSelection.getState()
    toggle(product('a'))
    toggle(product('b'))
    toggle(product('c'))
    remove(['a', 'b'])
    expect(ids()).toEqual(['c'])
  })

  it('clears', () => {
    const { toggle, clear } = useProductSelection.getState()
    toggle(product('a'))
    clear()
    expect(ids()).toEqual([])
    expect(useProductSelection.getState().refusedOn).toBeNull()
  })

  it('leaves out a row id the turn would refuse, and cuts a long lead', () => {
    expect(
      selectionForTurn([
        { rowId: 'bad id<script>', lead: 'Odd', cardMessageId: 'card-1' },
        { rowId: 'held:0', lead: `  ${'x'.repeat(200)}`, cardMessageId: 'card-1' },
      ]),
    ).toEqual([{ rowId: 'held:0', lead: 'x'.repeat(160) }])
  })

  it('goes on the turn without the card it was tapped on', () => {
    expect(selectionForTurn([product('a'), product('b', 'card-2')])).toEqual([
      { rowId: 'a', lead: 'Lead of a' },
      { rowId: 'b', lead: 'Lead of b' },
    ])
  })
})

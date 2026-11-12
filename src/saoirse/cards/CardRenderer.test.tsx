import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Card } from '@contracts/cards.ts'
import { assertNever } from '@/lib/assertNever'
import { CardRenderer } from './CardRenderer'

const marketProducts: Extract<Card, { type: 'market_products' }> = {
  type: 'market_products',
  question: 'What would the mortgage cost?',
  arrangement: {
    kind: 'mortgage_by_sort',
    title: 'Mortgage options at 90% loan-to-value',
    line: 'Arranged by monthly repayment, as you chose.',
  },
  rows: [
    {
      id: 'avant-4',
      lead: 'Avant Money',
      kind: '4-year fixed',
      value: '€1,598 a month',
      figure: '3.60%, then 4.10% variable',
      note: null,
      held: false,
      confirmed: true,
    },
  ],
  more: 0,
  basis: {
    figures: [],
    objective: 'Monthly repayment',
    assumptions: [],
    coverage: '',
    warnings: [],
  },
  statement: 'Information, not advice.',
}

describe('CardRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a market_products card', () => {
    render(<CardRenderer card={marketProducts} />)
    expect(
      screen.getByRole('heading', { name: 'Mortgage options at 90% loan-to-value' }),
    ).toBeInTheDocument()
  })

  it('throws, rather than rendering nothing, for a card type it does not know', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unknown = { type: 'not_a_card' } as unknown as Card
    expect(() => render(<CardRenderer card={unknown} />)).toThrow('Unhandled card: not_a_card')
  })
})

describe('assertNever', () => {
  it('names the value it was handed', () => {
    expect(() => assertNever('surprise' as never)).toThrow('Unhandled value: surprise')
  })
})

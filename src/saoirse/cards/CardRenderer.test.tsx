import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  CARD_TYPES,
  cardSchema,
  type Card,
  type MarketProductsCard,
  type ProductComparisonCard,
} from '@contracts/cards.ts'
import { assertNever } from '@/lib/assertNever'
import { CardRenderer } from './CardRenderer'

const marketProducts: MarketProductsCard = {
  type: 'market_products',
  question: 'What would the mortgage cost?',
  arrangement: {
    kind: 'mortgage_by_sort',
    title: 'Mortgage options at 90% loan-to-value',
    line: 'Arranged by monthly repayment, as you chose. Ask for them by 5-year cost instead.',
  },
  rows: [
    {
      id: 'avant:fixed-4',
      lead: 'Avant Money',
      kind: '4-year fixed at 3.25%',
      value: '€1,567/mo',
      figure: '€58,612 over 5 years',
      note: null,
      held: false,
      confirmed: true,
    },
  ],
  more: 0,
  basis: {
    figures: ['a €400,000 home, €360,000 borrowed (90% of the price)'],
    objective: 'Monthly repayment, lowest first.',
    assumptions: [],
    coverage: '11 lenders, checked 12 Nov 2026',
    warnings: ['Warning: the cost of your monthly repayments may increase.'],
  },
  statement:
    'Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares products on the figures you give.',
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

  it('renders a product_comparison card', () => {
    const comparison: ProductComparisonCard = {
      type: 'product_comparison',
      title: 'Avant Money and AIB side by side',
      columns: [
        { rowId: 'avant:fixed-4', lead: 'Avant Money', kind: '4-year fixed' },
        { rowId: 'aib:green-3', lead: 'AIB', kind: '3-year fixed' },
      ],
      rows: [{ label: 'Monthly', values: ['€1,567', '€1,612'], differs: true }],
      differences: ['The fixed periods differ by a year.'],
      decides: 'How long do you want the repayment fixed?',
      mustKnow: [],
      basis: { figures: [], assumptions: [], coverage: '2 lenders', warnings: [] },
      statement: marketProducts.statement,
    }
    render(<CardRenderer card={comparison} />)
    expect(
      screen.getByRole('heading', { name: 'Avant Money and AIB side by side' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
  })

  it('has a component for every card type in the contract', () => {
    // The switch is exhaustive by type; this holds the list and the switch to each other too.
    expect(CARD_TYPES).toContain('product_comparison')
    expect(new Set(CARD_TYPES).size).toBe(cardSchema.options.length)
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

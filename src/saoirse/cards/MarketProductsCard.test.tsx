import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Card } from '@contracts/cards.ts'
import { cardSchema } from '@contracts/cards.ts'
import { MarketProductsCard } from './MarketProductsCard'

type Payload = Extract<Card, { type: 'market_products' }>

const statement =
  'Information, not advice. Saoi is not regulated by the Central Bank of Ireland. Saoi earns nothing from any provider.'

const savingsBasis: Payload['basis'] = {
  figures: ['€25,000 saved', '€800 a month'],
  objective: 'Interest after DIRT over 12 months',
  assumptions: ['Rates stay as published', 'DIRT at 33%'],
  coverage: '14 savings and deposit accounts from 9 providers, checked 12 Nov 2026',
  warnings: [],
}

/** Their own account, sent second by the server, shown first by the card. */
const heldVsMarket: Payload = {
  type: 'market_products',
  question: 'What does my savings account earn against the market?',
  arrangement: {
    kind: 'held_vs_market',
    title: 'Your account against the market',
    line: 'Arranged by rate, your own account first. Ask for them by access, or by the date, instead.',
  },
  rows: [
    {
      id: 'bunq-easy',
      lead: 'bunq',
      kind: 'Easy savings',
      value: '2.51% AER',
      figure: '€421 after DIRT in a year',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'aib-online',
      lead: 'AIB Online Saver',
      kind: 'Regular saver',
      value: '0.10% AER',
      figure: '€17 after DIRT in a year',
      note: 'Up to €1,000 a month',
      held: true,
      confirmed: true,
    },
    {
      id: 'moco-savings',
      lead: 'MoCo',
      kind: 'Instant access',
      value: '2.25% AER',
      figure: '€377 after DIRT in a year',
      note: null,
      held: false,
      confirmed: false,
    },
  ],
  more: 4,
  basis: savingsBasis,
  statement,
}

const byAccess: Payload = {
  type: 'market_products',
  question: 'How soon can I get at the money?',
  arrangement: {
    kind: 'by_access',
    title: 'Instant access against fixed term',
    line: 'Arranged by access; the rate difference is the price of access. Ask for them by rate instead.',
  },
  rows: [
    {
      id: 'bunq-easy',
      lead: 'bunq',
      kind: 'Instant access',
      value: '2.51% AER',
      figure: 'Any day',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'ptsb-12m',
      lead: 'PTSB',
      kind: '12-month fixed term',
      value: '2.80% AER',
      figure: '0.29 points more, for 12 months locked',
      note: 'Early withdrawal not allowed',
      held: false,
      confirmed: true,
    },
  ],
  more: 0,
  basis: savingsBasis,
  statement,
}

const fitsDate: Payload = {
  type: 'market_products',
  question: 'Where should the deposit sit until the keys?',
  arrangement: {
    kind: 'fits_date',
    title: 'Accounts that fit July 2028',
    line: 'Six-month terms, since the keys are more than six months away. Ask for them by access instead.',
  },
  rows: [
    {
      id: 'boi-6m',
      lead: 'Bank of Ireland',
      kind: '6-month fixed term',
      value: '€1,018',
      figure: '€25,000 earns €1,018 after DIRT by July 2028',
      note: 'Bonus counted in the total',
      held: false,
      confirmed: true,
    },
  ],
  more: 1,
  basis: savingsBasis,
  statement,
}

const mortgageBySort: Payload = {
  type: 'market_products',
  question: 'What would the mortgage cost?',
  arrangement: {
    kind: 'mortgage_by_sort',
    title: 'Mortgage options at 90% loan-to-value',
    line: 'Arranged by monthly repayment, as you chose. Ask for them by 5-year cost instead.',
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
    {
      id: 'aib-green-3',
      lead: 'AIB',
      kind: '3-year fixed green',
      value: '€1,612 a month',
      figure: '3.45%, then 4.15% variable',
      note: 'Needs BER B3 or better',
      held: false,
      confirmed: false,
    },
  ],
  more: 9,
  basis: {
    figures: ['€360,000 loan over 30 years', '€400,000 home'],
    objective: 'Monthly repayment, lowest first',
    assumptions: ['First-time buyer', 'The follow-on rate is today’s variable'],
    coverage: '11 lenders, checked 12 Nov 2026',
    warnings: ['A lender assesses affordability itself; these are the published rates only.'],
  },
  statement,
}

const fixtures = [heldVsMarket, byAccess, fitsDate, mortgageBySort] as const

describe('MarketProductsCard', () => {
  it('parses every fixture against the contract', () => {
    for (const fixture of fixtures) {
      expect(cardSchema.parse(fixture)).toEqual(fixture)
    }
  })

  it.each(fixtures.map((card) => [card.arrangement.kind, card] as const))(
    'names its arrangement (%s) and how to change it, and closes with the statement',
    (_kind, card) => {
      render(<MarketProductsCard card={card} />)
      expect(screen.getByRole('heading', { name: card.arrangement.title })).toBeInTheDocument()
      expect(screen.getByText(card.arrangement.line)).toBeInTheDocument()
      expect(screen.getByText(statement)).toBeInTheDocument()
      const list = screen.getByRole('list', { name: card.arrangement.title })
      expect(within(list).getAllByRole('listitem')).toHaveLength(card.rows.length)
      for (const row of card.rows) {
        expect(within(list).getByText(row.value)).toBeInTheDocument()
        expect(within(list).getByText(row.figure)).toBeInTheDocument()
      }
      // Nothing on the card is a pick: the fold is the only control.
      expect(screen.getAllByRole('button')).toHaveLength(1)
    },
  )

  it('puts their own account first, marked as theirs', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    const items = within(
      screen.getByRole('list', { name: heldVsMarket.arrangement.title }),
    ).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('AIB Online Saver')
    expect(within(items[0]!).getByText('yours')).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('bunq')
    expect(screen.getAllByText('yours')).toHaveLength(1)
    expect(screen.getByText('Up to €1,000 a month')).toBeInTheDocument()
  })

  it('sets instant access and fixed term side by side, each with its kind', () => {
    render(<MarketProductsCard card={byAccess} />)
    expect(screen.getByText(/Instant access$/)).toBeInTheDocument()
    expect(screen.getByText(/12-month fixed term$/)).toBeInTheDocument()
    expect(screen.queryByText('yours')).not.toBeInTheDocument()
  })

  it('shows the accounts that fit the date with what they earn by then', () => {
    render(<MarketProductsCard card={fitsDate} />)
    expect(screen.getByText('€25,000 earns €1,018 after DIRT by July 2028')).toBeInTheDocument()
    expect(screen.getByText('1 more; ask to see it')).toBeInTheDocument()
  })

  it('lists lender rows with their monthly repayment', () => {
    render(<MarketProductsCard card={mortgageBySort} />)
    expect(screen.getByText('€1,598 a month')).toBeInTheDocument()
    expect(screen.getByText('€1,612 a month')).toBeInTheDocument()
    expect(screen.getByText(/3-year fixed green$/)).toBeInTheDocument()
  })

  it('says how many more there are, as something to ask for', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    expect(screen.getByText('4 more; ask to see them')).toBeInTheDocument()
  })

  it('says nothing about more when there are none', () => {
    render(<MarketProductsCard card={byAccess} />)
    expect(screen.queryByText(/more; ask to see/)).not.toBeInTheDocument()
  })

  it('marks an unconfirmed row and says what the mark means', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    expect(screen.getAllByLabelText('not confirmed')).toHaveLength(1)
    expect(screen.getByText(/Not confirmed on the provider’s own site/)).toBeInTheDocument()
  })

  it('has no mark and no footnote when every row is confirmed', () => {
    render(<MarketProductsCard card={byAccess} />)
    expect(screen.queryByLabelText('not confirmed')).not.toBeInTheDocument()
    expect(screen.queryByText(/Not confirmed on the provider’s own site/)).not.toBeInTheDocument()
  })

  it('folds the basis behind one line that opens and closes', () => {
    render(<MarketProductsCard card={mortgageBySort} />)
    const fold = screen.getByRole('button', { name: 'How this was worked out' })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('11 lenders, checked 12 Nov 2026')).not.toBeVisible()

    fireEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'How this was worked out' })
    expect(fold).toHaveAttribute('aria-controls', panel.id)
    for (const line of [
      ...mortgageBySort.basis.figures,
      mortgageBySort.basis.objective,
      ...mortgageBySort.basis.assumptions,
      mortgageBySort.basis.coverage,
      ...mortgageBySort.basis.warnings,
    ]) {
      expect(within(panel).getByText(line)).toBeVisible()
    }

    fireEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'false')
  })

  it('leaves out the warnings heading when there are none', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    fireEvent.click(screen.getByRole('button', { name: 'How this was worked out' }))
    expect(screen.queryByText('Warnings')).not.toBeInTheDocument()
    expect(screen.getByText('Assumed')).toBeInTheDocument()
  })

  it('says so when no product matches', () => {
    render(<MarketProductsCard card={{ ...byAccess, rows: [], more: 0 }} />)
    expect(screen.getByText('Nothing in the market matches this.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: byAccess.arrangement.title })).not.toBeInTheDocument()
  })
})

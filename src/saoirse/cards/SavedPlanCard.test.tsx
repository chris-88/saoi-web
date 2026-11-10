import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { Card } from '@contracts/cards.ts'
import { SavedPlanCard } from './SavedPlanCard'

const card: Extract<Card, { type: 'saved_plan' }> = {
  type: 'saved_plan',
  planId: '99999999-9999-4999-8999-999999999999',
  title: 'House deposit by November 2028',
  summary: 'Has €25,000 in a current account and can save €800 a month.',
  goals: [
    { label: 'House deposit', target: '€35,000 by November 2028' },
    { label: 'Rainy-day money', target: null },
  ],
  products: [
    {
      name: 'SuperSaver Account',
      providerName: 'Bank of Ireland',
      role: 'Monthly saving',
      amounts: ['€500 a month'],
      rate: '3.00% AER',
      projected: '€12,189 after 24 months, €189 interest after DIRT',
      provenance: 'Bank of Ireland’s own site, checked 9 Nov 2026',
      unknowns: [],
      checks: ['Paid by direct debit from a Bank of Ireland current account'],
      url: null,
    },
    {
      name: 'Online Saver',
      providerName: 'AIB',
      role: 'Monthly saving',
      amounts: ['€300 a month'],
      rate: '3.00% AER',
      projected: null,
      provenance: 'CCPC, checked 9 Nov 2026',
      unknowns: ['Monthly maximum'],
      checks: ['Check eligibility with AIB: CCPC does not record who can open it.'],
      url: 'https://personal.aib.ie/our-products/savings-and-deposits/online-saver',
    },
  ],
  debts: ['Car loan: overpay. At 9% it costs more than savings earn.'],
  basis: 'Ranked by interest after DIRT on €800 a month over 24 months.',
  assumptions: ['DIRT at 33% on all interest.'],
  attributions: ['Source: Competition and Consumer Protection Commission, www.ccpc.ie'],
  createdAt: '2026-11-09T12:30:00Z',
  dataCheckedAt: '2026-11-09T12:14:36Z',
}

describe('the saved comparison card', () => {
  it('shows only the goal, the figures line and the first three options, one line each', () => {
    render(
      <SavedPlanCard
        card={{
          ...card,
          title: 'Buying a home by November 2028',
          figures: '€25k saved · €800/mo · €90k · €350k',
          comparison: {
            headline:
              'At these figures, the deposit and buying costs are in place around July 2028.',
            sortedBy: '49 options that fit, sorted by cost over the first 5 years.',
            sortBy: 'five_year_cost',
            filters: [],
            total: 49,
            options: [
              {
                lender: 'Bank of Ireland',
                kind: '4-year fixed',
                rate: '3.2%',
                monthly: '€1,362/mo',
                fiveYear: '€49,338 over 5 years',
                keys: 'July 2028',
                confirmed: true,
                lead: '€49,338 / 5 yrs',
              },
              {
                lender: 'Avant Money',
                kind: '5-year fixed',
                rate: '3.7%',
                monthly: '€1,450/mo',
                fiveYear: '€49,385 over 5 years',
                keys: 'July 2028',
                confirmed: false,
                lead: '€49,385 / 5 yrs',
              },
              {
                lender: 'Avant Money',
                kind: '4-year fixed',
                rate: '3.7%',
                monthly: '€1,450/mo',
                fiveYear: '€50,107 over 5 years',
                keys: 'July 2028',
                confirmed: false,
                lead: '€50,107 / 5 yrs',
              },
            ],
          },
        }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Buying a home by November 2028' }),
    ).toBeInTheDocument()
    expect(screen.getByText('€25k saved · €800/mo · €90k · €350k')).toBeInTheDocument()
    const options = within(screen.getByRole('list', { name: 'The first three options' }))
    expect(options.getAllByRole('listitem')).toHaveLength(3)
    expect(options.getByText('€49,338')).toBeInTheDocument()
    expect(options.getByText('Bank of Ireland · 4-yr fixed')).toBeInTheDocument()
    expect(screen.getByText('First 3 of 49, by 5-year cost')).toBeInTheDocument()
    expect(screen.getByText(/^\* Incentives from CCPC/)).toBeInTheDocument()
    // Nothing else: no goals, no savings split, no debts, no basis.
    expect(screen.queryByText('SuperSaver Account')).not.toBeInTheDocument()
    expect(screen.queryByText(/Car loan/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ranked by/)).not.toBeInTheDocument()
    expect(screen.getByText(/not regulated by the Central Bank of Ireland/)).toBeInTheDocument()
  })

  it('falls back to the first three products for a plan with no home comparison', () => {
    render(<SavedPlanCard card={card} />)
    const rows = within(screen.getByRole('list', { name: 'In the comparison' }))
    expect(rows.getByText('Bank of Ireland · SuperSaver Account')).toBeInTheDocument()
    expect(rows.getByText('€500 a month')).toBeInTheDocument()
  })
})

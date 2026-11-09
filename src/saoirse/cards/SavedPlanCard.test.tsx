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

describe('the plan card', () => {
  it('shows the plan as the server built it, provenance and unknowns included', () => {
    render(<SavedPlanCard card={card} />)

    expect(screen.getByRole('heading', { name: card.title })).toBeInTheDocument()
    expect(screen.getByText('€35,000 by November 2028')).toBeInTheDocument()

    const products = within(screen.getByRole('list', { name: /products in the plan/i }))
    expect(products.getAllByText(/^\d\. Monthly saving/)).toHaveLength(2)
    expect(products.getByText('SuperSaver Account')).toBeInTheDocument()
    expect(products.getByText('CCPC, checked 9 Nov 2026')).toBeInTheDocument()
    expect(products.getByText('Not published: Monthly maximum')).toBeInTheDocument()
    expect(products.getByText(/^Check: Paid by direct debit/)).toBeInTheDocument()
    // A check that already says "Check" is not prefixed again.
    expect(products.getByText(/^Check eligibility with AIB/)).toBeInTheDocument()
    expect(products.queryByText(/Check: Check/)).not.toBeInTheDocument()
    expect(products.getByRole('link', { name: /AIB’s page/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )

    expect(screen.getByText(/Car loan: overpay/)).toBeInTheDocument()
    expect(screen.getByText(/Information, not advice/)).toBeInTheDocument()
    expect(screen.getByText(/Competition and Consumer Protection Commission/)).toBeInTheDocument()
  })
})

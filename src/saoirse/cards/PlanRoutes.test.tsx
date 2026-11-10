import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Card } from '@contracts/cards.ts'
import type { PlanRoute } from '@/lib/planRoutes'
import { SavedPlanCard } from './SavedPlanCard'

const source = (url: string) => ({ fact: 'Limits', url, checkedOn: '2026-11-10' })

const ROUTES: PlanRoute[] = [
  {
    id: 'second_hand',
    mechanism: 'The usual route: a deposit, stamp duty and fees',
    keysOn: null,
    confirmed: true,
    name: 'Second-hand',
    status: 'potential',
    line: 'Second-hand: deposit and buying costs saved by July 2028',
    reason: 'Nothing given rules it out.',
    missing: null,
    conditions: ['Central Bank limits: 4x income, 10% deposit'],
    sources: [source('https://www.centralbank.ie/limits')],
  },
  {
    id: 'new_build_help_to_buy',
    mechanism: 'A tax refund from Revenue towards the deposit',
    keysOn: null,
    confirmed: true,
    name: 'New build with Help to Buy',
    status: 'needs_one_detail',
    line: 'New build: Help to Buy up to €30,000, depending on tax paid',
    reason: null,
    missing: 'How much Income Tax and DIRT have you paid over the last four years?',
    conditions: ['New build or self-build', 'Price up to €500,000'],
    sources: [source('https://www.revenue.ie/htb'), source('https://www.revenue.ie/htb2')],
  },
  {
    id: 'first_home_scheme',
    mechanism: 'Shared equity: the State takes a share of the price',
    keysOn: null,
    confirmed: true,
    name: 'First Home Scheme',
    status: 'potential',
    line: 'First Home Scheme: shared equity up to 30% on a new build',
    reason: 'Price under the county limit.',
    missing: null,
    conditions: [],
    sources: [],
  },
  {
    id: 'local_authority_home_loan',
    mechanism: 'An alternative mortgage from the council',
    keysOn: null,
    confirmed: true,
    name: 'Local Authority Home Loan',
    status: 'not_applicable',
    line: 'Local Authority Home Loan: income above the €80,000 ceiling',
    reason: 'Income €90,000 is above €80,000 for one applicant.',
    missing: null,
    conditions: [],
    sources: [],
  },
  {
    id: 'vacant_property_grant',
    mechanism: 'A grant for works after purchase, not the deposit',
    keysOn: null,
    confirmed: true,
    name: 'Vacant Property Refurbishment Grant',
    status: 'potential',
    line: 'Vacant Property Grant: up to €70,000 for works after purchase',
    reason: null,
    missing: null,
    conditions: [],
    sources: [],
  },
]

const base: Extract<Card, { type: 'saved_plan' }> = {
  type: 'saved_plan',
  planId: '99999999-9999-4999-8999-999999999999',
  title: 'Buying a home by November 2028',
  summary: '',
  goals: [],
  products: [],
  debts: [],
  basis: '',
  assumptions: [],
  attributions: [],
  createdAt: '2026-11-10T12:30:00Z',
  dataCheckedAt: '2026-11-10T12:14:36Z',
  routes: [],
}

// Until the card contract carries `routes`, a card with them is wider than the type.
const withRoutes = { ...base, routes: ROUTES }

describe('the routes under a saved comparison', () => {
  it('shows the first three lines in order, the rest behind "More routes"', () => {
    const card = withRoutes
    render(<SavedPlanCard card={card} />)
    const list = within(screen.getByRole('list', { name: 'Routes to a home' }))
    const rows = list.getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual(ROUTES.slice(0, 3).map((r) => r.line))
    expect(screen.queryByText(/Local Authority Home Loan/)).not.toBeInTheDocument()
    expect(screen.queryByText(/best/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'More routes (2)' }))
    expect(list.getAllByRole('button')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /More routes/ })).not.toBeInTheDocument()
  })

  it('opens a row to its missing question, conditions and the first source', () => {
    render(<SavedPlanCard card={withRoutes} />)
    const row = screen.getByRole('button', {
      name: 'New build: Help to Buy up to €30,000, depending on tax paid',
    })
    const question = screen.getByText(/Income Tax and DIRT/)
    expect(question).not.toBeVisible()
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(question).toBeVisible()
    expect(screen.getByText('Price up to €500,000')).toBeVisible()
    const links = screen.getAllByRole('link', { name: /New build with Help to Buy/ })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://www.revenue.ie/htb')
  })

  it('shows no routes section when the card carries none', () => {
    render(<SavedPlanCard card={base} />)
    expect(screen.queryByRole('list', { name: 'Routes to a home' })).not.toBeInTheDocument()
    expect(screen.queryByText(/More routes/)).not.toBeInTheDocument()
  })
})

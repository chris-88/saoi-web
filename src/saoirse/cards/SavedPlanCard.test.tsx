import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Card } from '@contracts/cards.ts'
import type { CaseHoldingsResponse } from '@contracts/holdings.ts'
import type { CasePlanRead } from '@/lib/planChoices'

const fetchCaseHoldings = vi.fn<(caseId: string) => Promise<CaseHoldingsResponse>>()
const fetchCasePlan = vi.fn<(caseId: string) => Promise<CasePlanRead | null>>()
vi.mock('@/lib/saoiApi', () => ({
  fetchCaseHoldings: (caseId: string) => fetchCaseHoldings(caseId),
  fetchCasePlan: (caseId: string) => fetchCasePlan(caseId),
}))

const { SavedPlanCard } = await import('./SavedPlanCard')

beforeEach(() => {
  fetchCaseHoldings.mockReset()
  fetchCasePlan.mockReset()
  fetchCasePlan.mockResolvedValue(null)
})

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
  routes: [],
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

  describe('progress against the plan', () => {
    const CASE = '22222222-2222-4222-8222-222222222222'
    const LINE =
      '€6,500 owed, €9,000 when the plan was made; at €400 a month that is 17 months, to April 2028, before interest.'

    function inCase(caseId: string | null) {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <SavedPlanCard card={card} caseId={caseId} />
        </QueryClientProvider>,
      )
    }

    it('shows the server’s progress line under the figures', async () => {
      fetchCaseHoldings.mockResolvedValue({
        holdings: [],
        progress: {
          goal: 'pay_off_debt',
          goalLabel: 'Clear the car loan',
          owedNowEur: 6500,
          owedFrom: 'plan',
          planOwedEur: 9000,
          changeEur: -2500,
          monthlyEur: 400,
          monthsLeft: 17,
          clearedIn: '2028-04',
          line: LINE,
        },
      })
      inCase(CASE)
      expect(await screen.findByText(LINE)).toBeInTheDocument()
      expect(fetchCaseHoldings).toHaveBeenCalledWith(CASE)
    })

    it('shows nothing when the plan has no progress to report', async () => {
      fetchCaseHoldings.mockResolvedValue({ holdings: [], progress: null })
      inCase(CASE)
      await waitFor(() => expect(fetchCaseHoldings).toHaveBeenCalled())
      expect(screen.queryByText(/before interest|saved;/)).not.toBeInTheDocument()
    })

    it('reads nothing without a case', () => {
      inCase(null)
      expect(fetchCaseHoldings).not.toHaveBeenCalled()
    })
  })
})

describe('a home plan carrying what the host card showed', () => {
  const arrival = {
    keysOn: '2027-09',
    readyLine: 'September 2027',
    readyNote: 'Before interest',
    factParts: [
      '€40,000 deposit',
      '+ €4,000 stamp duty',
      '+ €3,000 legal and survey',
      '− €35,000 Help to Buy',
    ],
    progress: { savedEur: 50_000, neededEur: 47_000, monthlySavingEur: 1_500 },
    tiles: [
      {
        label: 'Savings',
        qualifier: 'up to',
        value: '3.11%',
        sub: ['€815 interest', 'by Jul 2028'],
        quiet: ['28 accounts'],
        detail: ['The best rate among 28 accounts open to you, after DIRT.', 'Variable rates.'],
        lines: ['€815 interest', 'by Jul 2028', '28 accounts'],
      },
      {
        label: 'Mortgage',
        qualifier: 'from',
        value: '€1,751/mo',
        sub: ['€405,000 loan', 'from 3.20%'],
        quiet: ['49 options'],
        detail: ['Over 30 years at the lowest rate of 49 options.'],
        lines: ['€405,000 loan', 'from 3.20%', '49 options'],
      },
      {
        label: 'Could afford',
        qualifier: 'up to',
        value: '€666,000',
        sub: ['4× income', '90% loan'],
        quiet: [],
        detail: [],
        lines: ['4× income', '90% loan'],
      },
    ],
    assumptions: [
      'Assumed: first-time buyers. Estimates only; rates and offers are not confirmed.',
    ],
    hookQuestion: null,
  }
  const homeCard: Extract<Card, { type: 'saved_plan' }> = {
    ...card,
    arrival,
    comparison: {
      headline: 'At these figures, the money at the keys is in place around September 2027.',
      sortedBy: '41 options that fit, sorted by cost over the first 5 years.',
      sortBy: 'five_year_cost',
      filters: [],
      total: 41,
      options: [
        {
          lender: 'Bank of Ireland',
          kind: '4-year fixed',
          rate: '3.45%',
          monthly: '€1,607/mo',
          fiveYear: '€51,000 over 5 years',
          keys: 'September 2027',
          confirmed: true,
        },
      ],
    },
  }

  it('is drawn as the arrival card, the same as on arrival, and names no lender or product', () => {
    render(<SavedPlanCard card={homeCard} />)
    expect(screen.getByText('September 2027')).toBeInTheDocument()
    expect(screen.getByText('Before interest')).toBeInTheDocument()
    expect(screen.getByText('− €35,000 Help to Buy')).toBeInTheDocument()
    expect(screen.getByText('Covered')).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'At a glance' })).getAllByRole('listitem'),
    ).toHaveLength(3)
    expect(document.body.textContent).not.toMatch(/(?<!Central )Bank of Ireland|AIB|SuperSaver/)
    expect(screen.queryByRole('list', { name: 'The first three options' })).not.toBeInTheDocument()
    expect(screen.getByText(/not regulated by the Central Bank of Ireland/)).toBeInTheDocument()
  })

  it('lays out each tile: the qualifier above the value, the sub lines, the quiet count', () => {
    render(<SavedPlanCard card={homeCard} />)
    const [savings, mortgage, afford] = within(
      screen.getByRole('list', { name: 'At a glance' }),
    ).getAllByRole('listitem')
    const parts = (tile: HTMLElement | undefined): string[] =>
      [...(tile?.querySelectorAll(':scope > * > span') ?? [])].map((part) => part.textContent)
    // Label row, qualifier row, value, each sub string, the quiet count.
    expect(parts(savings)).toEqual([
      'Savings',
      'up to',
      '3.11%',
      '€815 interest',
      'by Jul 2028',
      '28 accounts',
    ])
    expect(parts(mortgage)).toEqual([
      'Mortgage',
      'from',
      '€1,751/mo',
      '€405,000 loan',
      'from 3.20%',
      '49 options',
    ])
    expect(parts(afford)).toEqual(['Could afford', 'up to', '€666,000', '4× income', '90% loan'])
  })

  it('keeps an empty qualifier row when a tile has none, so the values line up', () => {
    const [first, ...rest] = homeCard.arrival?.tiles ?? []
    if (first === undefined || homeCard.arrival === undefined) throw new Error('fixture')
    render(
      <SavedPlanCard
        card={{
          ...homeCard,
          arrival: { ...homeCard.arrival, tiles: [{ ...first, qualifier: null }, ...rest] },
        }}
      />,
    )
    const savings = within(screen.getByRole('list', { name: 'At a glance' })).getAllByRole(
      'listitem',
    )[0]
    const rows = [...(savings?.querySelectorAll(':scope > * > span') ?? [])]
    expect(rows.map((row) => row.textContent).slice(0, 3)).toEqual(['Savings', '', '3.11%'])
  })

  it('opens a tile’s detail on a tap, one at a time; a tile without detail is not a button', () => {
    render(<SavedPlanCard card={homeCard} />)
    const savings = screen.getByRole('button', { name: /^Savings/ })
    const mortgage = screen.getByRole('button', { name: /^Mortgage/ })
    expect(screen.queryByRole('button', { name: /^Could afford/ })).not.toBeInTheDocument()
    expect(savings).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Variable rates.')).not.toBeVisible()

    fireEvent.click(savings)
    expect(savings).toHaveAttribute('aria-expanded', 'true')
    const detail = screen.getByRole('region', { name: 'Savings' })
    expect(savings).toHaveAttribute('aria-controls', detail.id)
    expect(within(detail).getByText('Variable rates.')).toBeVisible()

    fireEvent.click(mortgage)
    expect(savings).toHaveAttribute('aria-expanded', 'false')
    expect(mortgage).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Over 30 years at the lowest rate of 49 options.')).toBeVisible()
    expect(screen.getByText('Variable rates.')).not.toBeVisible()

    fireEvent.click(mortgage)
    expect(mortgage).toHaveAttribute('aria-expanded', 'false')
  })

  it('makes each expandable tile a native button in the tab order', () => {
    render(<SavedPlanCard card={homeCard} />)
    const savings = screen.getByRole('button', { name: /^Savings/ })
    // A real <button type="button">: Enter and Space work without a key handler of our own.
    expect(savings.tagName).toBe('BUTTON')
    expect(savings).toHaveAttribute('type', 'button')
    savings.focus()
    expect(savings).toHaveFocus()
  })

  it('keeps the progress line from the case’s holdings', async () => {
    const LINE = '€6,500 owed, €9,000 when the plan was made.'
    fetchCaseHoldings.mockResolvedValue({
      holdings: [],
      progress: {
        goal: 'pay_off_debt',
        goalLabel: 'Clear the car loan',
        owedNowEur: 6500,
        owedFrom: 'plan',
        planOwedEur: 9000,
        changeEur: -2500,
        monthlyEur: 400,
        monthsLeft: 17,
        clearedIn: '2028-04',
        line: LINE,
      },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SavedPlanCard card={homeCard} caseId="22222222-2222-4222-8222-222222222222" />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(LINE)).toBeInTheDocument()
  })
})

describe('the choices on the plan card', () => {
  const CASE = '22222222-2222-4222-8222-222222222222'
  const PLAN: CasePlanRead = {
    planId: card.planId,
    title: card.title,
    editable: {
      targetDate: '2028-11',
      homePrice: 350000,
      monthlySaving: 1000,
      propertyKind: null,
      firstTimeBuyer: null,
      buyingTogether: null,
    },
    summary: { keysOn: '2028-11', neededAtKeysEur: 40000, savedEur: 32000, progressLine: null },
    watched: [],
    updatedAt: '2026-11-12T10:00:00.000Z',
    choices: {
      lump_sum: null,
      monthly_saving: {
        slot: 'monthly_saving',
        rowId: 'boi:supersaver',
        lead: 'Bank of Ireland SuperSaver',
        kind: 'regular saver',
        value: '3.00%',
        figure: '€702 by Nov 2028',
        chosenAt: '2026-11-13T09:00:00.000Z',
      },
      mortgage: null,
    },
  }

  const mortgageOption = {
    lender: 'Bank of Ireland',
    kind: '4-year fixed',
    rate: '3.2%',
    monthly: '€1,362/mo',
    fiveYear: '€49,338 over 5 years',
    keys: 'July 2028',
    confirmed: true,
    lead: '€49,338 / 5 yrs',
  }

  function inCase(caseId: string | null, payload: typeof card = card) {
    fetchCaseHoldings.mockResolvedValue({ holdings: [], progress: null })
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SavedPlanCard card={payload} caseId={caseId} />
      </QueryClientProvider>,
    )
  }

  it('lists the three slots under the figures, the open ones not chosen yet', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    inCase(CASE)
    const block = await screen.findByRole('region', { name: 'Your choices' })
    await within(block).findByText('Bank of Ireland SuperSaver')
    const terms = within(block)
      .getAllByRole('term')
      .map((term) => term.textContent)
    expect(terms).toEqual(['Your €32,000', 'Your €1,000 a month', 'Your mortgage'])
    const values = within(block)
      .getAllByRole('definition')
      .map((value) => value.textContent)
    expect(values).toEqual([
      'not chosen yet',
      'Bank of Ireland SuperSaver€702 by Nov 2028',
      'not chosen yet',
    ])
  })

  it('says so while the choices load, and when they would not', async () => {
    fetchCasePlan.mockRejectedValue(new Error('offline'))
    inCase(CASE)
    const block = screen.getByRole('region', { name: 'Your choices' })
    expect(within(block).getByRole('status')).toHaveTextContent('Looking up your choices…')
    expect(await within(block).findByRole('alert')).toHaveTextContent(
      'Your choices would not load. offline',
    )
  })

  it('has no choices block without a case', () => {
    inCase(null)
    expect(screen.queryByRole('region', { name: 'Your choices' })).not.toBeInTheDocument()
    expect(fetchCasePlan).not.toHaveBeenCalled()
  })

  it('offers Choose on a mortgage row only once it carries a row id', async () => {
    fetchCasePlan.mockResolvedValue({
      ...PLAN,
      choices: {
        ...PLAN.choices,
        mortgage: {
          slot: 'mortgage',
          rowId: 'boi:fixed-4',
          lead: 'Bank of Ireland · 4-yr fixed',
          kind: '4-year fixed',
          value: '3.2%',
          figure: '€1,362/mo',
          chosenAt: '2026-11-13T09:00:00.000Z',
        },
      },
    })
    const withRowId = { ...mortgageOption, rowId: 'boi:fixed-4' }
    const comparison = {
      headline: 'Keys around July 2028.',
      sortedBy: 'Sorted by cost over 5 years.',
      sortBy: 'five_year_cost' as const,
      filters: [],
      total: 2,
      options: [withRowId, { ...mortgageOption, lender: 'AIB' }],
    }
    inCase(CASE, { ...card, comparison })
    const options = within(screen.getByRole('list', { name: 'The first three options' }))
    expect(
      options.getByRole('button', { name: 'Choose Bank of Ireland · 4-yr fixed' }),
    ).toBeVisible()
    expect(options.queryByRole('button', { name: /choose aib/i })).not.toBeInTheDocument()
    expect(await options.findByText('your mortgage')).toBeInTheDocument()
  })
})

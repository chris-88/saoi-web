import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  MarketProductsCard as ProductsPayload,
  ProductComparisonCard as ComparisonPayload,
} from '@contracts/cards.ts'
import type { CasePlanRead, PlanChoice, PlanChoiceRequest } from '@/lib/planChoices'
import { SaoiApiError } from '@/api/client'

const fetchCasePlan = vi.fn<(caseId: string) => Promise<CasePlanRead | null>>()
const choosePlanProduct =
  vi.fn<(caseId: string, body: PlanChoiceRequest) => Promise<CasePlanRead>>()
vi.mock('@/lib/saoiApi', () => ({
  fetchCasePlan: (caseId: string) => fetchCasePlan(caseId),
  choosePlanProduct: (caseId: string, body: PlanChoiceRequest) => choosePlanProduct(caseId, body),
}))

const { CompareBar } = await import('@/saoirse/CompareBar')
const { useProductSelection } = await import('@/saoirse/productSelection')
const { MarketProductsCard } = await import('@/saoirse/cards/MarketProductsCard')
const { ProductComparisonCard } = await import('@/saoirse/cards/ProductComparisonCard')

const CASE = '22222222-2222-4222-8222-222222222222'

const PLAN: CasePlanRead = {
  planId: '44444444-4444-4444-8444-444444444444',
  title: 'A first home in Dublin',
  editable: {
    targetDate: '2028-03',
    homePrice: 400000,
    monthlySaving: 1000,
    propertyKind: 'second_hand',
    firstTimeBuyer: true,
    buyingTogether: false,
  },
  summary: { keysOn: '2028-03', neededAtKeysEur: 48000, savedEur: 32000, progressLine: null },
  watched: [],
  updatedAt: '2026-11-12T10:00:00.000Z',
  choices: { lump_sum: null, monthly_saving: null, mortgage: null },
}

const choice = (slot: PlanChoice['slot'], rowId: string, lead: string): PlanChoice => ({
  slot,
  rowId,
  lead,
  kind: 'instant access',
  value: '2.51%',
  figure: '€421 in a year',
  chosenAt: '2026-11-13T09:00:00.000Z',
})

const withChoice = (next: PlanChoice): CasePlanRead => ({
  ...PLAN,
  choices: { ...PLAN.choices, [next.slot]: next },
})

const select = (rowId: string, lead: string): void => {
  act(() => {
    useProductSelection.getState().toggle({ rowId, lead, cardMessageId: 'card-1' })
  })
}

function withQuery(children: ReactNode): ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const renderBar = (caseId: string | null = CASE): void => {
  render(withQuery(<CompareBar onCompare={vi.fn()} canSend caseId={caseId} />))
}

const openSheet = async (): Promise<HTMLElement> => {
  fireEvent.click(screen.getByRole('button', { name: 'Choose for…' }))
  const sheet = await screen.findByRole('dialog', { name: 'Choose for your plan' })
  await within(sheet).findByRole('list', { name: 'Choose for' })
  return sheet
}

beforeEach(() => {
  vi.clearAllMocks()
  useProductSelection.getState().clear()
  fetchCasePlan.mockResolvedValue(PLAN)
})

describe('Choose for… on the compare bar', () => {
  it('is offered with exactly one selected, and not with none or two', () => {
    renderBar()
    expect(screen.queryByRole('button', { name: 'Choose for…' })).not.toBeInTheDocument()

    select('bunq:easy-savings', 'bunq Easy Savings')
    expect(screen.getByRole('button', { name: 'Choose for…' })).toBeInTheDocument()

    select('boi:supersaver', 'SuperSaver')
    expect(screen.queryByRole('button', { name: 'Choose for…' })).not.toBeInTheDocument()
  })

  it('is not offered without a conversation to choose into', () => {
    renderBar(null)
    select('bunq:easy-savings', 'bunq Easy Savings')
    expect(screen.queryByRole('button', { name: 'Choose for…' })).not.toBeInTheDocument()
  })

  it('names the three slots in the plan’s own figures, each a button', async () => {
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()
    expect(within(sheet).getByText('bunq Easy Savings')).toBeInTheDocument()
    const slots = within(within(sheet).getByRole('list', { name: 'Choose for' })).getAllByRole(
      'button',
    )
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'My €32,000',
      'My €1,000 a month',
      'My mortgage',
    ])
  })

  it('says so while the plan loads', async () => {
    fetchCasePlan.mockReturnValue(new Promise(() => undefined))
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    fireEvent.click(screen.getByRole('button', { name: 'Choose for…' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Looking up your plan…')
  })

  it('uses plain words when there is no plan', async () => {
    fetchCasePlan.mockResolvedValue(null)
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()
    expect(
      within(sheet)
        .getAllByRole('button')
        .map((slot) => slot.textContent),
    ).toEqual(expect.arrayContaining(['My lump sum', 'My monthly saving', 'My mortgage']))
  })

  it('still offers the slots, in plain words, when the plan would not load', async () => {
    fetchCasePlan.mockRejectedValue(new Error('offline'))
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Your plan would not load. offline')
    expect(within(sheet).getByRole('button', { name: 'My monthly saving' })).toBeEnabled()
  })

  it('chooses with the POST, then clears the selection, closes and reads the plan again', async () => {
    choosePlanProduct.mockResolvedValue(
      withChoice(choice('monthly_saving', 'bunq:easy-savings', 'bunq Easy Savings')),
    )
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: 'My €1,000 a month' }))

    await waitFor(() =>
      expect(choosePlanProduct).toHaveBeenCalledWith(CASE, {
        slot: 'monthly_saving',
        rowId: 'bunq:easy-savings',
      }),
    )
    await waitFor(() => expect(useProductSelection.getState().selected).toEqual([]))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Choose for your plan' })).toBeNull(),
    )
    await waitFor(() => expect(fetchCasePlan).toHaveBeenCalledTimes(2))
  })

  it('asks before replacing another product in that slot, and keeps it on "Keep it"', async () => {
    fetchCasePlan.mockResolvedValue(
      withChoice(choice('monthly_saving', 'boi:supersaver', 'Bank of Ireland SuperSaver')),
    )
    choosePlanProduct.mockResolvedValue(
      withChoice(choice('monthly_saving', 'bunq:easy-savings', 'bunq Easy Savings')),
    )
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()

    const slot = within(sheet).getByRole('button', { name: /my €1,000 a month/i })
    expect(slot).toHaveTextContent('Now: Bank of Ireland SuperSaver')
    fireEvent.click(slot)
    const confirm = within(sheet).getByRole('group', { name: 'Replace the choice' })
    expect(confirm).toHaveTextContent('Replace Bank of Ireland SuperSaver with bunq Easy Savings?')
    expect(within(confirm).getByRole('button', { name: 'Replace' })).toHaveFocus()
    expect(choosePlanProduct).not.toHaveBeenCalled()

    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    expect(within(sheet).queryByRole('group', { name: 'Replace the choice' })).toBeNull()
    expect(choosePlanProduct).not.toHaveBeenCalled()

    fireEvent.click(slot)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Replace' }))
    await waitFor(() =>
      expect(choosePlanProduct).toHaveBeenCalledWith(CASE, {
        slot: 'monthly_saving',
        rowId: 'bunq:easy-savings',
      }),
    )
  })

  it('does not offer a slot this product already holds', async () => {
    fetchCasePlan.mockResolvedValue(
      withChoice(choice('lump_sum', 'bunq:easy-savings', 'bunq Easy Savings')),
    )
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()
    const slot = within(sheet).getByRole('button', { name: /my €32,000/i })
    expect(slot).toBeDisabled()
    expect(slot).toHaveTextContent('Chosen already')
  })

  it('shows the server’s sentence when the choice is refused, and keeps the selection', async () => {
    choosePlanProduct.mockRejectedValue(
      new SaoiApiError(400, 'A savings account cannot be your mortgage.'),
    )
    renderBar()
    select('bunq:easy-savings', 'bunq Easy Savings')
    const sheet = await openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: 'My mortgage' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'That was not chosen. A savings account cannot be your mortgage.',
    )
    expect(useProductSelection.getState().selected).toHaveLength(1)
  })
})

const products: ProductsPayload = {
  type: 'market_products',
  question: 'Where could my €32,000 go?',
  arrangement: {
    kind: 'by_access',
    title: 'Instant access against fixed term',
    line: 'Arranged by access.',
  },
  rows: [
    {
      id: 'bunq:easy-savings',
      lead: 'bunq Easy Savings',
      kind: 'instant access',
      value: '2.51%',
      figure: '€421 in a year',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'ptsb:fixed-12',
      lead: 'PTSB Fixed Term',
      kind: '1-year fixed',
      value: '2.80%',
      figure: '€469 in a year',
      note: null,
      held: false,
      confirmed: true,
    },
  ],
  more: 0,
  basis: { figures: [], objective: 'By access', assumptions: [], coverage: 'All', warnings: [] },
  statement: 'Information, not advice.',
}

describe('a chosen row', () => {
  it('carries the slot in short words, from the live plan', async () => {
    fetchCasePlan.mockResolvedValue(
      withChoice(choice('lump_sum', 'bunq:easy-savings', 'bunq Easy Savings')),
    )
    render(withQuery(<MarketProductsCard card={products} cardId="c1" caseId={CASE} />))
    const chosen = screen.getByRole('checkbox', { name: /bunq easy savings/i })
    await waitFor(() => expect(chosen).toHaveTextContent('your €32,000'))
    expect(chosen).toHaveAccessibleName(expect.stringContaining('Chosen for your €32,000'))
    expect(screen.getByRole('checkbox', { name: /ptsb fixed term/i })).not.toHaveTextContent('your')
  })

  it('names the monthly saving and the mortgage the same way', async () => {
    fetchCasePlan.mockResolvedValue({
      ...PLAN,
      choices: {
        lump_sum: null,
        monthly_saving: choice('monthly_saving', 'bunq:easy-savings', 'bunq Easy Savings'),
        mortgage: choice('mortgage', 'ptsb:fixed-12', 'PTSB Fixed Term'),
      },
    })
    render(withQuery(<MarketProductsCard card={products} cardId="c1" caseId={CASE} />))
    expect(await screen.findByText('your monthly saving')).toBeInTheDocument()
    expect(screen.getByText('your mortgage')).toBeInTheDocument()
  })

  it('reads nothing without a case', () => {
    render(withQuery(<MarketProductsCard card={products} cardId="c1" />))
    expect(fetchCasePlan).not.toHaveBeenCalled()
  })
})

const comparison: ComparisonPayload = {
  type: 'product_comparison',
  title: 'bunq Easy Savings and PTSB Fixed Term',
  columns: [
    { rowId: 'bunq:easy-savings', lead: 'bunq Easy Savings', kind: 'instant access' },
    { rowId: 'ptsb:fixed-12', lead: 'PTSB Fixed Term', kind: '1-year fixed' },
  ],
  rows: [{ label: 'Rate', values: ['2.51%', '2.80%'], differs: true }],
  differences: [],
  decides: 'Will you need the money within the year?',
  mustKnow: [],
  basis: { figures: [], assumptions: [], coverage: 'The two selected', warnings: [] },
  statement: 'Information, not advice.',
}

describe('a comparison column', () => {
  it('has its own Choose, which opens the sheet for that column', async () => {
    choosePlanProduct.mockResolvedValue(PLAN)
    render(withQuery(<ProductComparisonCard card={comparison} caseId={CASE} />))
    fireEvent.click(screen.getByRole('button', { name: 'Choose PTSB Fixed Term' }))
    const sheet = await screen.findByRole('dialog', { name: 'Choose for your plan' })
    expect(within(sheet).getByText('PTSB Fixed Term')).toBeInTheDocument()
    fireEvent.click(await within(sheet).findByRole('button', { name: 'My €32,000' }))
    await waitFor(() =>
      expect(choosePlanProduct).toHaveBeenCalledWith(CASE, {
        slot: 'lump_sum',
        rowId: 'ptsb:fixed-12',
      }),
    )
  })

  it('carries the badge when chosen', async () => {
    fetchCasePlan.mockResolvedValue(
      withChoice(choice('monthly_saving', 'bunq:easy-savings', 'bunq Easy Savings')),
    )
    render(withQuery(<ProductComparisonCard card={comparison} caseId={CASE} />))
    const header = screen.getByRole('columnheader', { name: /bunq easy savings/i })
    await waitFor(() => expect(header).toHaveTextContent('your monthly saving'))
  })

  it('offers no Choose without a case', () => {
    render(withQuery(<ProductComparisonCard card={comparison} />))
    expect(screen.queryByRole('button', { name: /^choose/i })).not.toBeInTheDocument()
  })
})

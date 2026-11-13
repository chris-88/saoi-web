import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListCasesResponse } from '@contracts/session.ts'
import type { CaseHoldingsResponse, Holding } from '@contracts/holdings.ts'
import type { Identity } from '@/lib/identity'
import type { CasePlan, CasePlanEdit, CasePlanEdited } from '@contracts/case-plan.ts'
import type { PlanChoiceSlot } from '@contracts/market-plan.ts'
import type * as IdentityModule from '@/lib/identity'

const listCases = vi.fn<() => Promise<ListCasesResponse>>()
const fetchCaseHoldings = vi.fn<(caseId: string) => Promise<CaseHoldingsResponse>>()
const currentIdentity = vi.fn<() => Promise<Identity>>()
const fetchCasePlan = vi.fn<(caseId: string) => Promise<CasePlan | null>>()
const removePlanChoice = vi.fn<(caseId: string, slot: PlanChoiceSlot) => Promise<CasePlan>>()
const updateCasePlan = vi.fn<(caseId: string, body: CasePlanEdit) => Promise<CasePlanEdited>>()

vi.mock('@/lib/session', () => ({
  listCases: () => listCases(),
  startNewCase: vi.fn(),
  switchCase: vi.fn(),
}))
vi.mock('@/lib/saoiApi', () => ({
  fetchCaseHoldings: (caseId: string) => fetchCaseHoldings(caseId),
  fetchCaseSnapshot: vi.fn(),
  createHolding: vi.fn(),
  updateHolding: vi.fn(),
  deleteHolding: vi.fn(),
  fetchCasePlan: (caseId: string) => fetchCasePlan(caseId),
  updateCasePlan: (caseId: string, body: CasePlanEdit) => updateCasePlan(caseId, body),
  removePlanChoice: (caseId: string, slot: PlanChoiceSlot) => removePlanChoice(caseId, slot),
}))
vi.mock('@/lib/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof IdentityModule>()),
  currentIdentity: () => currentIdentity(),
  lastKnownAddress: () => null,
}))

const { You } = await import('./You')
const { takeComposerLine, takeSaoirseLine } = await import('@/lib/planArrival')

const CASE = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'

const ANON: Identity = { anonymous: true, email: null, name: null, avatarUrl: null }
const CHRIS: Identity = {
  anonymous: false,
  email: 'chris@example.test',
  name: 'Chris Quinn',
  avatarUrl: null,
}

const cases = (presenter = false): ListCasesResponse => ({
  presenter,
  cases: [
    {
      caseId: CASE,
      label: null,
      opening: 'Saving for a house',
      messages: 4,
      applications: 0,
      lastActivityAt: '2026-11-12T09:00:00.000Z',
      current: true,
      mine: true,
    },
    {
      caseId: OTHER,
      label: 'Demo 2',
      opening: null,
      messages: 0,
      applications: 0,
      lastActivityAt: null,
      current: false,
      mine: true,
    },
  ],
})

const PLAN: CasePlan = {
  planId: '44444444-4444-4444-8444-444444444444',
  title: 'A first home in Dublin',
  editable: {
    targetDate: '2028-03',
    homePrice: 400000,
    monthlySaving: 1500,
    propertyKind: 'second_hand',
    firstTimeBuyer: true,
    buyingTogether: false,
  },
  summary: {
    keysOn: '2028-03',
    neededAtKeysEur: 48000,
    savedEur: 12000,
    progressLine: 'At €1,500 a month the deposit is there by January 2028.',
  },
  watched: [
    {
      lead: 'Bank of Ireland',
      kind: 'instant access',
      value: '2.50%',
      figure: '€1,140 interest by March 2028',
    },
    { lead: 'AIB', kind: 'six-month deposit', value: '2.75%', figure: '€1,210 by March 2028' },
  ],
  updatedAt: '2026-11-12T10:00:00.000Z',
  choices: { lump_sum: null, monthly_saving: null, mortgage: null },
}

/** The plan with a product chosen for the monthly saving. */
const CHOSEN: CasePlan = {
  ...PLAN,
  choices: {
    lump_sum: null,
    monthly_saving: {
      slot: 'monthly_saving',
      rowId: 'bunq:savings.bunq_savings',
      lead: 'bunq Easy Savings',
      providerId: 'bunq',
      kind: 'instant access',
      value: '2.01%',
      figure: '€815 by Mar 2028',
      chosenAt: '2026-11-13T09:00:00.000Z',
    },
    mortgage: null,
  },
}

/** When an edit that changed something was saved: after the plan's own time. */
const EDITED_AT = '2026-11-12T11:00:00.000Z'

const holding = (kind: Holding['kind'], balance: number): Holding => ({
  id: `55555555-5555-4555-8555-${String(balance).padStart(12, '0')}`,
  kind,
  label: kind,
  provider: null,
  productId: null,
  balance,
  ratePct: null,
  monthlyAmountEur: null,
  fixedUntil: null,
  notedOn: '2026-11-11',
  source: 'plan',
  reminderId: null,
  createdAt: '2026-11-11T10:00:00.000Z',
  updatedAt: '2026-11-11T10:00:00.000Z',
})

beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
})

function renderAt(path: string): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/you" element={<You />} />
          <Route path="/you/:section" element={<You />} />
          <Route path="/" element={<p>The chat</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listCases.mockResolvedValue(cases())
  currentIdentity.mockResolvedValue(ANON)
  fetchCasePlan.mockResolvedValue(null)
  fetchCaseHoldings.mockResolvedValue({
    holdings: [holding('savings', 33000), holding('car_finance', 6500)],
    progress: null,
  })
})

describe('You', () => {
  it('lists every part of the old menu as a row, with the figures that are cheap to know', async () => {
    renderAt('/you')

    expect(screen.getByRole('link', { name: 'Back to Saoirse' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start a new conversation' })).toBeInTheDocument()

    const money = screen.getByRole('link', { name: /your money/i })
    expect(money).toHaveAttribute('href', '/you/money')
    await waitFor(() =>
      expect(within(money).getByText('€33,000 saved · €6,500 owed')).toBeInTheDocument(),
    )

    expect(screen.getByRole('link', { name: /reminders/i })).toHaveAttribute(
      'href',
      '/you/reminders',
    )
    expect(screen.getByRole('link', { name: /notifications/i })).toHaveAttribute(
      'href',
      '/you/notifications',
    )
    const conversations = screen.getByRole('link', { name: /conversations/i })
    expect(conversations).toHaveAttribute('href', '/you/conversations')
    await waitFor(() => expect(within(conversations).getByText('2')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /how your data is used/i })).toHaveAttribute(
      'href',
      '/privacy',
    )
    // Nothing is linked, so there is nothing to stop and no row saying so.
    expect(screen.queryByRole('link', { name: /linked accounts/i })).not.toBeInTheDocument()
  })

  it('offers sign-in while anonymous, and the account with a way out once signed in', () => {
    renderAt('/you')
    expect(screen.getByText('Not signed in')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    // The form is behind one tap: it is the tallest thing on the page.
    expect(screen.queryByRole('button', { name: /send me a code/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('button', { name: /send me a code/i })).toBeInTheDocument()
  })

  it('shows who is signed in', async () => {
    currentIdentity.mockResolvedValue(CHRIS)
    renderAt('/you')
    await waitFor(() => expect(screen.getByText('Chris Quinn')).toBeInTheDocument())
    expect(screen.getByText('chris@example.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByText('Not signed in')).not.toBeInTheDocument()
  })

  it('opens Your money for the conversation this browser is in', async () => {
    renderAt('/you/money')
    expect(screen.getByRole('heading', { level: 1, name: 'Your money' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to You' })).toHaveAttribute('href', '/you')
    await waitFor(() => expect(fetchCaseHoldings).toHaveBeenCalledWith(CASE))
    expect(await screen.findByText('€33,000')).toBeInTheDocument()
    // The page says what it is once; the section does not say it again.
    expect(screen.getAllByText('Your money')).toHaveLength(1)
  })

  it('lists the conversations and marks the current one', async () => {
    listCases.mockResolvedValue(cases(true))
    renderAt('/you/conversations')
    expect(await screen.findByText(/presenter mode/i)).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Your conversations' })
    const current = within(list).getByRole('button', { name: /saving for a house/i })
    expect(current).toBeDisabled()
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(within(list).getByRole('button', { name: /demo 2/i })).toBeEnabled()
  })

  it('says so when there is no conversation yet', async () => {
    listCases.mockResolvedValue({ presenter: false, cases: [] })
    renderAt('/you/reminders')
    expect(await screen.findByText(/nothing here until/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Saoirse' })).toHaveAttribute('href', '/')
  })

  it('shows the error when the conversation cannot be looked up', async () => {
    listCases.mockRejectedValue(new Error('offline'))
    renderAt('/you')
    expect(await screen.findByText(/could not be looked up/i)).toHaveTextContent('offline')
  })

  it('has no page for a section that does not exist', () => {
    renderAt('/you/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('Your plan', () => {
  it('has no row on You when the conversation has no plan', async () => {
    renderAt('/you')
    await waitFor(() => expect(fetchCasePlan).toHaveBeenCalledWith(CASE))
    await screen.findByText('€33,000 saved · €6,500 owed')
    expect(screen.queryByRole('link', { name: /^your plan/i })).not.toBeInTheDocument()
  })

  it('has a row above Your money with the keys month and saved of needed', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    renderAt('/you')
    const row = await screen.findByRole('link', { name: /^your plan/i })
    expect(row).toHaveAttribute('href', '/you/plan')
    expect(row).toHaveTextContent('Keys March 2028 · €12,000 of €48,000 saved')
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links.indexOf('/you/plan')).toBe(links.indexOf('/you/money') - 1)
  })

  it('shows the goal and keys month, saved of needed, what is watched, and what is coming', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    renderAt('/you/plan')
    expect(screen.getByRole('heading', { level: 1, name: 'Your plan' })).toBeInTheDocument()
    expect(await screen.findByText('A first home in Dublin')).toBeInTheDocument()
    expect(screen.getByText('Keys March 2028')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: /saved towards the money needed/i }),
    ).toHaveAttribute('aria-valuenow', '12000')
    expect(screen.getByText(/the deposit is there by January 2028/)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /price of the home: €400,000/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kind of home: second-hand/i })).toBeInTheDocument()

    const watched = screen.getByRole('list', { name: 'Options you are watching' })
    expect(within(watched).getAllByRole('listitem')).toHaveLength(2)
    expect(within(watched).getByText('€1,140 interest by March 2028')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /balances and debts/i })).toHaveAttribute(
      'href',
      '/you/money',
    )

    const coming = screen.getByRole('list', { name: 'Coming' })
    const placeholders = within(coming).getAllByRole('listitem')
    expect(placeholders.map((item) => item.textContent)).toEqual([
      'StatementsNot yet',
      'ID and proof of addressNot yet',
      'Application packNot yet',
    ])
    for (const item of placeholders) expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(within(coming).queryByRole('link')).not.toBeInTheDocument()
    expect(within(coming).queryByRole('button')).not.toBeInTheDocument()
  })

  it('says so when there is no plan', async () => {
    renderAt('/you/plan')
    expect(await screen.findByText(/no saved plan in this conversation/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Saoirse' })).toHaveAttribute('href', '/')
  })

  it('shows the error with a way to try again', async () => {
    fetchCasePlan.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(PLAN)
    renderAt('/you/plan')
    expect(await screen.findByText(/would not load/i)).toHaveTextContent('offline')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('A first home in Dublin')).toBeInTheDocument()
  })

  it('sends only the changed field, then opens the chat on Saoirse’s reading', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    const reading =
      'Saving €1,200 a month means €9,000 less saved by March 2028; the six-month deposits no longer fit.'
    updateCasePlan.mockResolvedValue({ ...PLAN, updatedAt: EDITED_AT, reading })
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /saved each month/i }))
    const input = screen.getByLabelText('Saved each month (€)')
    await waitFor(() => expect(input).toHaveFocus())
    fireEvent.change(input, { target: { value: '1,200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The chat')).toBeInTheDocument()
    expect(updateCasePlan).toHaveBeenCalledWith(CASE, { monthlySaving: 1200 })
    expect(takeSaoirseLine()).toBe(reading)
  })

  it('changes the kind of home with the segmented control', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    updateCasePlan.mockResolvedValue({
      ...PLAN,
      updatedAt: EDITED_AT,
      reading: 'A new build changes it.',
    })
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /kind of home/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'New build' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateCasePlan).toHaveBeenCalledWith(CASE, { propertyKind: 'new_build' }),
    )
    expect(await screen.findByText('The chat')).toBeInTheDocument()
    expect(takeSaoirseLine()).toBe('A new build changes it.')
  })

  it('opens one row at a time, and closes without a request when nothing changed', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /first-time buyer/i }))
    expect(screen.getByRole('switch', { name: 'First-time buyer' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: /buying together/i }))
    expect(screen.queryByRole('switch', { name: 'First-time buyer' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Buying together' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.queryByRole('switch', { name: 'Buying together' })).not.toBeInTheDocument(),
    )
    expect(updateCasePlan).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /buying together/i })).toHaveFocus()
  })

  it('refuses a month in the past and a price of nothing, with a message', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /date you gave/i }))
    expect(
      screen.getByText(/The keys month above is when the money is there at this pace/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Date you gave'), { target: { value: '2020-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Choose this month or a later one.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: /price of the home/i }))
    fireEvent.change(screen.getByLabelText('Price of the home (€)'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a price above €0.')).toBeInTheDocument()

    expect(updateCasePlan).not.toHaveBeenCalled()
  })

  it('refuses a monthly saving of nothing, as the server would', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /saved each month/i }))
    fireEvent.change(screen.getByLabelText('Saved each month (€)'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter an amount above €0.')).toBeInTheDocument()
    expect(updateCasePlan).not.toHaveBeenCalled()
  })

  it('stays on the page when the server says nothing changed', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    updateCasePlan.mockResolvedValue({
      ...PLAN,
      reading: 'Nothing changed: the plan already has these figures.',
    })
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /price of the home/i }))
    fireEvent.change(screen.getByLabelText('Price of the home (€)'), {
      target: { value: '410000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateCasePlan).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.queryByLabelText('Price of the home (€)')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('The chat')).not.toBeInTheDocument()
    expect(takeSaoirseLine()).toBeNull()
  })

  it('offers no price or kind of home on a plan that is not for a home', async () => {
    fetchCasePlan.mockResolvedValue({
      ...PLAN,
      title: 'A wedding',
      editable: {
        targetDate: '2027-09',
        homePrice: null,
        monthlySaving: 600,
        propertyKind: null,
        firstTimeBuyer: null,
        buyingTogether: null,
      },
      summary: { keysOn: null, neededAtKeysEur: null, savedEur: null, progressLine: null },
    })
    renderAt('/you/plan')

    expect(await screen.findByText('By September 2027')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /goal month: september 2027/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saved each month/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /goal month/i }))
    expect(screen.queryByText(/keys month above/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    for (const name of [/price of the home/i, /kind of home/i, /first-time/i, /buying together/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  describe('Your choices', () => {
    it('shows each slot in their figures, open ones not chosen yet', async () => {
      fetchCasePlan.mockResolvedValue(CHOSEN)
      renderAt('/you/plan')
      const list = await screen.findByRole('list', { name: 'Your choices' })
      const items = within(list).getAllByRole('listitem')
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveTextContent('Your €12,000')
      expect(items[0]).toHaveTextContent('Not chosen yet')
      expect(items[1]).toHaveTextContent('Your €1,500 a month')
      expect(items[1]).toHaveTextContent('bunq Easy Savings')
      expect(items[1]).toHaveTextContent('€815 by Mar 2028')
      expect(items[2]).toHaveTextContent('Your mortgage')
      expect(items[2]).toHaveTextContent('Not chosen yet')
      // Remove only where there is something to remove.
      expect(within(list).getAllByRole('button', { name: /^remove/i })).toHaveLength(1)
    })

    it('says how to choose when nothing is chosen', async () => {
      fetchCasePlan.mockResolvedValue(PLAN)
      renderAt('/you/plan')
      expect(await screen.findByText(/then “Choose for…”/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^remove/i })).not.toBeInTheDocument()
    })

    it('removes a choice with the DELETE, then reads the plan again', async () => {
      fetchCasePlan.mockResolvedValueOnce(CHOSEN).mockResolvedValue(PLAN)
      removePlanChoice.mockResolvedValue(PLAN)
      renderAt('/you/plan')
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Remove bunq Easy Savings from your €1,500 a month',
        }),
      )
      await waitFor(() => expect(removePlanChoice).toHaveBeenCalledWith(CASE, 'monthly_saving'))
      await waitFor(() => expect(screen.queryByText('bunq Easy Savings')).not.toBeInTheDocument())
      expect(fetchCasePlan).toHaveBeenCalledTimes(2)
    })

    it('shows the server’s sentence when a removal is refused', async () => {
      fetchCasePlan.mockResolvedValue(CHOSEN)
      removePlanChoice.mockRejectedValue(new Error('That choice has already gone.'))
      renderAt('/you/plan')
      fireEvent.click(await screen.findByRole('button', { name: /^remove bunq/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That was not removed. That choice has already gone.',
      )
      expect(screen.getByText('bunq Easy Savings')).toBeInTheDocument()
    })

    it('changes in the chat, with their line waiting in the composer', async () => {
      fetchCasePlan.mockResolvedValue(CHOSEN)
      renderAt('/you/plan')
      fireEvent.click(await screen.findByRole('button', { name: 'Change your €1,500 a month' }))
      expect(await screen.findByText('The chat')).toBeInTheDocument()
      expect(takeComposerLine()).toBe('Show me the options for my monthly saving again')
      expect(takeComposerLine()).toBeNull()
    })

    it('asks for the options of an open slot, without "again"', async () => {
      fetchCasePlan.mockResolvedValue(CHOSEN)
      renderAt('/you/plan')
      fireEvent.click(await screen.findByRole('button', { name: 'See options for your mortgage' }))
      expect(await screen.findByText('The chat')).toBeInTheDocument()
      expect(takeComposerLine()).toBe('Show me the options for my mortgage')
    })
  })

  it('keeps the row open with the reason when the save fails', async () => {
    fetchCasePlan.mockResolvedValue(PLAN)
    updateCasePlan.mockRejectedValue(new Error('Saoirse is unavailable right now.'))
    renderAt('/you/plan')

    fireEvent.click(await screen.findByRole('button', { name: /price of the home/i }))
    fireEvent.change(screen.getByLabelText('Price of the home (€)'), {
      target: { value: '420000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That was not saved. Saoirse is unavailable right now.',
    )
    expect(screen.queryByText('The chat')).not.toBeInTheDocument()
    expect(takeSaoirseLine()).toBeNull()
  })
})

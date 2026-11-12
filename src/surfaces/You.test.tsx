import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListCasesResponse } from '@contracts/session.ts'
import type { CaseHoldingsResponse, Holding } from '@contracts/holdings.ts'
import type { Identity } from '@/lib/identity'
import type * as IdentityModule from '@/lib/identity'

const listCases = vi.fn<() => Promise<ListCasesResponse>>()
const fetchCaseHoldings = vi.fn<(caseId: string) => Promise<CaseHoldingsResponse>>()
const currentIdentity = vi.fn<() => Promise<Identity>>()

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
}))
vi.mock('@/lib/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof IdentityModule>()),
  currentIdentity: () => currentIdentity(),
  lastKnownAddress: () => null,
}))

const { You } = await import('./You')

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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listCases.mockResolvedValue(cases())
  currentIdentity.mockResolvedValue(ANON)
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

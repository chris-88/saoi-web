import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SaoiApiError } from '@/api/client'

const claimPlan = vi.fn<(token: string) => Promise<unknown>>()
const previewPlan = vi.fn<(token: string) => Promise<unknown>>()

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isBackendConfigured: true,
}))
vi.mock('@/lib/session', () => ({
  claimPlan: (token: string) => claimPlan(token),
  previewPlan: (token: string) => previewPlan(token),
}))

const { PlanArrival } = await import('./PlanArrival')
const { takeFirstMessage } = await import('@/lib/planArrival')
const { problemOf } = await import('@/lib/planClaim')

const HOOK =
  'How much Income Tax and DIRT have you both paid over the last four years? It decides whether Help to Buy covers the €35,000.'

const route = (id: string, line: string) => ({
  id,
  name: id,
  mechanism: 'How the route works',
  status: 'potential',
  line,
  reason: null,
  missing: null,
  keysOn: null,
  conditions: [],
  confirmed: true,
  sources: [],
})

/** The spec's couple: €110,000, €32,000 saved, looking at €400,000, tax paid not given. */
const ARRIVAL = {
  keysOn: '2027-09',
  readyLine: 'September 2027',
  readyNote: null,
  factParts: ['€40,000 deposit', '+ €4,000 stamp duty', '+ €3,000 legal and survey'],
  progress: { savedEur: 32_000, neededEur: 47_000, monthlySavingEur: 1_500 },
  tiles: [
    {
      label: 'Savings',
      qualifier: 'up to',
      value: '3.11%',
      sub: ['€815 interest', 'by Jul 2028'],
      quiet: ['28 accounts'],
      detail: ['The best rate among 28 accounts open to you, after DIRT.'],
    },
    {
      label: 'Mortgage',
      qualifier: 'from',
      value: '€1,751/mo',
      sub: ['€405,000 loan', 'from 3.20%'],
      quiet: ['49 options'],
      detail: ['Over 30 years at the lowest rate of 49 options.'],
    },
    {
      label: 'Could afford',
      qualifier: 'up to',
      value: '€666,000',
      sub: ['4× income', '90% loan'],
      quiet: [],
      detail: ['4 times €148,000 income, plus the deposit.'],
    },
  ],
  assumptions: [
    'Assumed: a new build, first-time buyers. Estimates only; rates and offers are not confirmed.',
  ],
  hookQuestion: { key: 'tax_paid', question: HOOK, why: 'Help to Buy €35,000 conditional' },
}

const PREVIEW = {
  title: 'Buying a home by November 2028',
  figures: '€32k saved · €1,500/mo · €110k · €400k',
  comparison: null,
  products: [],
  routes: [
    route(
      'new_build_help_to_buy',
      'New build with Help to Buy: keys September 2027 if tax paid covers €35,000',
    ),
    route('second_hand', 'Second-hand: €47,000 needed at the keys, not reached at this pace'),
    route('first_home_scheme', 'First Home Scheme: shared equity up to €80,000 on a new build'),
    route('vacant_property_grant', 'Vacant property grant: up to €50,000 for works'),
    route('local_authority_home_loan', 'Local Authority Home Loan: not at €110,000 joint income'),
    route('affordable_purchase', 'Affordable purchase: not at €110,000 for a €400,000 home'),
  ],
  arrival: ARRIVAL,
  opening: HOOK,
  expiresAt: '2026-11-13T12:00:00.000Z',
}

function open(token = 'AAAAAAAAAAAAAAAAAAAAAA') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/plan/${token}`]}>
        <Routes>
          <Route path="/plan/:token" element={<PlanArrival token={token} />} />
          <Route path="/" element={<p>the conversation</p>} />
          <Route path="/privacy" element={<p>the notice</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Saoirse's bubbles: the muted ones on the left. */
const saoirseLines = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('.rounded-bl-sm')].map((node) => node.textContent)

/** Types into the composer and presses Enter, as a customer would. */
function write(text: string) {
  const box = screen.getByRole('textbox', { name: 'Message Saoirse' })
  box.textContent = text
  fireEvent.input(box)
  fireEvent.keyDown(box, { key: 'Enter' })
}

beforeEach(() => {
  claimPlan.mockReset()
  previewPlan.mockReset()
  previewPlan.mockResolvedValue(PREVIEW)
  takeFirstMessage()
})

describe('a saved comparison arriving in the app', () => {
  it('shows the host card’s figures: the month, what it is made of, the meter and three tiles', async () => {
    open()
    expect(await screen.findByText('September 2027')).toBeInTheDocument()
    expect(screen.getByText('Ready to buy')).toBeInTheDocument()
    expect(screen.getByText('€40,000 deposit')).toBeInTheDocument()
    expect(screen.getByText('+ €3,000 legal and survey')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '32000')
    expect(screen.getByText('€32,000 of €47,000')).toBeInTheDocument()
    expect(screen.getByText('€15,000 to go')).toBeInTheDocument()

    const tiles = within(screen.getByRole('list', { name: 'At a glance' })).getAllByRole('listitem')
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      'Savingsup to3.11%€815 interestby Jul 202828 accounts',
      'Mortgagefrom€1,751/mo€405,000 loanfrom 3.20%49 options',
      'Could affordup to€666,0004× income90% loan',
    ])
    expect(screen.getByText(/^Assumed: a new build, first-time buyers/)).toBeInTheDocument()
  })

  it('lists two other supports, then every one on a tap', async () => {
    open()
    const supports = await screen.findByRole('list', { name: 'Other supports' })
    expect(
      within(supports)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Second-hand: €47,000 needed at the keys, not reached at this pace',
      'First Home Scheme: shared equity up to €80,000 on a new build',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'See all 6 supports' }))
    expect(within(supports).getAllByRole('listitem')).toHaveLength(6)
  })

  it('a small grey box links to the data protection notice, and the notice is not repeated here', async () => {
    open()
    const notice = await screen.findByRole('link', {
      name: 'Click here for the data protection notice',
    })
    expect(notice).toHaveAttribute('href', '/privacy')
    expect(notice).toHaveClass('bg-muted')
    expect(screen.queryByText(/sent to Anthropic/)).not.toBeInTheDocument()
    fireEvent.click(notice)
    expect(await screen.findByText('the notice')).toBeInTheDocument()
    expect(claimPlan).not.toHaveBeenCalled()
  })

  it('Saoirse says the hook question and nothing else: no welcome, no chips', async () => {
    const { container } = open()
    expect(await screen.findByText(HOOK)).toBeInTheDocument()
    expect(saoirseLines(container)).toEqual([HOOK])
    expect(screen.queryByText(/Hi, I’m Saoirse/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /carry on|talk me through/i })).toBeNull()
  })

  it('nothing is claimed until they write; their first message claims, then goes to the chat', async () => {
    let finish: (value: unknown) => void = () => undefined
    claimPlan.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    open('BBBBBBBBBBBBBBBBBBBBBB')
    await screen.findByText(HOOK)
    expect(claimPlan).not.toHaveBeenCalled()

    write('About €40,000 between us')
    await waitFor(() => {
      expect(claimPlan).toHaveBeenCalledWith('BBBBBBBBBBBBBBBBBBBBBB')
    })
    expect(screen.getByText('About €40,000 between us')).toBeInTheDocument()

    finish({})
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    // The chat sends it as the first turn, once.
    expect(takeFirstMessage()).toBe('About €40,000 between us')
    expect(takeFirstMessage()).toBeNull()
  })

  it('a busy server keeps what they wrote and claims again on Try again', async () => {
    claimPlan.mockRejectedValueOnce(new SaoiApiError(429, 'busy'))
    claimPlan.mockResolvedValueOnce({})
    open()
    await screen.findByText(HOOK)
    write('About €40,000')
    expect(await screen.findByText(/Saoi is busy right now/)).toBeInTheDocument()
    expect(screen.getByText('About €40,000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    expect(claimPlan).toHaveBeenCalledTimes(2)
    expect(takeFirstMessage()).toBe('About €40,000')
  })
})

describe('an older plan, or one without a home goal', () => {
  /** The server's line for a plan with no hook question (saoi `domain/market/arrival.ts`). */
  const CARRY_ON =
    'Your comparison is here, with every figure as you left it. What would you like to look at first?'
  const OLD = {
    ...PREVIEW,
    routes: [],
    arrival: null,
    opening: CARRY_ON,
    products: [
      { name: 'Online Regular Saver', provider: 'PTSB', line: '€500 a month' },
      { name: '12 Month Fixed Term Deposit', provider: 'AIB', line: '€20,000' },
    ],
  }

  it('falls back to the compact card, the notice box and one line to carry on', async () => {
    previewPlan.mockResolvedValue(OLD)
    const { container } = open()
    expect(await screen.findByText('Buying a home by November 2028')).toBeInTheDocument()
    expect(screen.getByText('PTSB · Online Regular Saver')).toBeInTheDocument()
    expect(screen.queryByText('Ready to buy')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Click here for the data protection notice' }),
    ).toBeInTheDocument()
    expect(saoirseLines(container)).toEqual([CARRY_ON])
  })

  it('says the server’s line verbatim, whatever it is', async () => {
    previewPlan.mockResolvedValue({ ...OLD, opening: 'Your comparison is here.' })
    const { container } = open()
    await waitFor(() => {
      expect(saoirseLines(container)).toEqual(['Your comparison is here.'])
    })
  })
})

describe('a link that cannot be opened', () => {
  it('says an expired link has expired, in the chat, with a chip to start again', async () => {
    previewPlan.mockRejectedValue(new SaoiApiError(410, 'expired'))
    open()
    expect(await screen.findByText(/That link has expired/)).toBeInTheDocument()
    expect(screen.queryByText('Ready to buy')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
  })

  it('says a used link was opened elsewhere', async () => {
    previewPlan.mockRejectedValue(new SaoiApiError(409, 'used'))
    open()
    expect(await screen.findByText(/already been opened/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('shows Saoirse typing while the preview loads, and holds the send', () => {
    previewPlan.mockReturnValue(new Promise(() => undefined))
    open()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('what a refusal means', () => {
  it('maps the server’s statuses', () => {
    expect(problemOf(new SaoiApiError(404, ''))).toBe('unknown')
    expect(problemOf(new SaoiApiError(409, ''))).toBe('used')
    expect(problemOf(new SaoiApiError(410, ''))).toBe('expired')
    expect(problemOf(new SaoiApiError(429, ''))).toBe('busy')
    expect(problemOf(new Error('offline'))).toBe('failed')
  })
})

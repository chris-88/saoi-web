import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SaoiApiError } from '@/api/client'

const claimPlan = vi.fn<(token: string) => Promise<unknown>>()
const previewPlan = vi.fn<(token: string) => Promise<unknown>>()

const PREVIEW = {
  title: 'Buying a home by November 2028',
  figures: '€25k saved · €800/mo · €90k · €350k',
  comparison: {
    headline: 'At these figures, the deposit and buying costs are in place around July 2028.',
    sortedBy: '49 options that fit, sorted by cost over the first 5 years, lowest first.',
    filters: ['Showing Bank of Ireland options, as you asked.'],
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
      },
      {
        lender: 'Avant Money',
        kind: '5-year fixed',
        rate: '3.7%',
        monthly: '€1,450/mo',
        fiveYear: '€49,385 over 5 years',
        keys: 'July 2028',
        confirmed: false,
      },
    ],
  },
  products: [],
  expiresAt: '2026-11-11T12:00:00.000Z',
}

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isBackendConfigured: true,
}))
vi.mock('@/lib/session', () => ({
  claimPlan: (token: string) => claimPlan(token),
  previewPlan: (token: string) => previewPlan(token),
}))

const { PlanClaim } = await import('./PlanClaim')
const { problemOf } = await import('@/lib/planClaim')

function open(token = 'AAAAAAAAAAAAAAAAAAAAAA') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/plan/${token}`]}>
        <Routes>
          <Route path="/plan/:token" element={<PlanClaim />} />
          <Route path="/" element={<p>the conversation</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  claimPlan.mockReset()
  previewPlan.mockReset()
  previewPlan.mockResolvedValue(PREVIEW)
})

describe('arriving from a saved comparison, one step at a time', () => {
  it('welcomes with the comparison, shows the notice, then claims and opens the chat', async () => {
    claimPlan.mockResolvedValue({})
    open('BBBBBBBBBBBBBBBBBBBBBB')
    expect(await screen.findByRole('heading', { name: 'Welcome to Saoi' })).toBeInTheDocument()
    expect(screen.getByText('€25k saved · €800/mo · €90k · €350k')).toBeInTheDocument()
    expect(screen.getByText('Bank of Ireland')).toBeInTheDocument()
    expect(screen.getByText('Unconfirmed')).toBeInTheDocument()
    expect(screen.getByText(/47 more options/)).toBeInTheDocument()
    // Nothing is stored by reading it.
    expect(claimPlan).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: 'Before you continue' })).toBeInTheDocument()
    expect(screen.getByText(/On Saoi’s own servers in Ireland/)).toBeInTheDocument()
    expect(screen.getByText(/Nothing is sold/)).toBeInTheDocument()
    expect(claimPlan).not.toHaveBeenCalled()
    const more = screen.getByRole('button', { name: /read the full notice/i })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/24 hours after it was saved/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    expect(claimPlan).toHaveBeenCalledWith('BBBBBBBBBBBBBBBBBBBBBB')
    expect(previewPlan).toHaveBeenCalledWith('BBBBBBBBBBBBBBBBBBBBBB')
  })

  it('says a used link was opened elsewhere, and offers a fresh start', async () => {
    previewPlan.mockRejectedValue(new SaoiApiError(409, 'used'))
    open()
    expect(await screen.findByRole('heading', { name: /already been opened/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start a fresh chat/i })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('says an expired link has expired, plainly, with a way to start again', async () => {
    previewPlan.mockRejectedValue(new SaoiApiError(410, 'expired'))
    open()
    expect(await screen.findByRole('heading', { name: /expired/i })).toBeInTheDocument()
    expect(screen.getByText(/save it again for a fresh link/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start a fresh chat/i })).toBeInTheDocument()
  })

  it('lets a busy refusal be tried again, since the link is not spent', async () => {
    previewPlan.mockRejectedValueOnce(new SaoiApiError(429, 'busy')).mockResolvedValueOnce(PREVIEW)
    open()
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('heading', { name: 'Welcome to Saoi' })).toBeInTheDocument()
    expect(previewPlan).toHaveBeenCalledTimes(2)
  })
})

describe('what a refusal means', () => {
  it('maps the server’s statuses', () => {
    expect(problemOf(new SaoiApiError(404, ''))).toBe('unknown')
    expect(problemOf(new SaoiApiError(400, ''))).toBe('unknown')
    expect(problemOf(new SaoiApiError(409, ''))).toBe('used')
    expect(problemOf(new SaoiApiError(410, ''))).toBe('expired')
    expect(problemOf(new SaoiApiError(429, ''))).toBe('busy')
    expect(problemOf(new SaoiApiError(500, ''))).toBe('failed')
    expect(problemOf(new Error('offline'))).toBe('failed')
  })
})

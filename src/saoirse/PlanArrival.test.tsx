import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
const { arrivalFollowUps, takeArrivalPrelude } = await import('@/lib/planArrival')
const { problemOf } = await import('@/lib/planClaim')

const PREVIEW = {
  title: 'Buying a home by November 2028',
  figures: '€25k saved · €800/mo · €90k · €350k',
  comparison: null,
  products: [],
  expiresAt: '2026-11-11T12:00:00.000Z',
}

function open(token = 'AAAAAAAAAAAAAAAAAAAAAA') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/plan/${token}`]}>
        <Routes>
          <Route path="/plan/:token" element={<PlanArrival token={token} />} />
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
  takeArrivalPrelude()
})

describe('a saved comparison arriving in the chat', () => {
  it('Saoirse welcomes, gives the notice, and nothing is claimed until they accept', async () => {
    claimPlan.mockResolvedValue({})
    open('BBBBBBBBBBBBBBBBBBBBBB')
    expect(
      await screen.findByText(
        'Hi, I’m Saoirse. I’ve got the comparison you were working on: buying a home by November 2028.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/stored on Saoi’s own servers in Ireland/)).toBeInTheDocument()
    expect(screen.getByText(/sent to Anthropic/)).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { hidden: true })).toBeTruthy()
    expect(claimPlan).not.toHaveBeenCalled()

    const more = screen.getByRole('button', { name: /read the full notice/i })
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/24 hours after it was saved/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /that’s fine, carry on/i }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    expect(claimPlan).toHaveBeenCalledWith('BBBBBBBBBBBBBBBBBBBBBB')
    // The welcome and the notice are handed to the chat once.
    expect(takeArrivalPrelude()?.welcome).toMatch(/^Hi, I’m Saoirse/)
    expect(takeArrivalPrelude()).toBeNull()
  })

  it('gives the anonymous calculator record in the notice, word for word', async () => {
    open()
    expect(
      await screen.findByText(
        'Each run of the home calculator keeps one anonymous record: the day, an income band, how many months to the keys (banded), whether the date is met, and the county, rent band, kind of home and first-time buyer if given. No figures, no names, nothing that identifies you.',
      ),
    ).toBeInTheDocument()
  })

  it('a home plan with routes: the welcome counts them once and the routes chip is offered', async () => {
    const route = {
      id: 'second_hand',
      name: 'Second-hand',
      status: 'potential',
      line: 'Second-hand: saved by July 2028',
      reason: null,
      missing: null,
      conditions: [],
      sources: [],
    }
    previewPlan.mockResolvedValue({
      ...PREVIEW,
      routes: [route, { ...route, id: 'first_home_scheme' }],
    })
    claimPlan.mockResolvedValue({})
    open()
    expect(
      await screen.findByText(
        'Hi, I’m Saoirse. I’ve got the comparison you were working on: buying a home by November 2028, and 2 routes to a home.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /that’s fine, carry on/i }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    const prelude = takeArrivalPrelude()
    expect(prelude?.routeCount).toBe(2)
    expect(arrivalFollowUps(prelude?.routeCount ?? 0).map((chip) => chip.label)).toEqual([
      'Talk me through these',
      'Change a figure',
      'How was this worked out?',
      'Tell me about the other routes',
    ])
  })

  it('no routes: no count in the welcome and no routes chip', async () => {
    claimPlan.mockResolvedValue({})
    open()
    expect(await screen.findByText(/buying a home by November 2028\.$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /that’s fine, carry on/i }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    const prelude = takeArrivalPrelude()
    expect(prelude?.routeCount).toBe(0)
    expect(arrivalFollowUps(0).map((chip) => chip.label)).not.toContain(
      'Tell me about the other routes',
    )
  })

  it('says an expired link has expired, in the chat, with a chip to start again', async () => {
    previewPlan.mockRejectedValue(new SaoiApiError(410, 'expired'))
    open()
    expect(await screen.findByText(/That link has expired/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
  })

  it('says a used link was opened elsewhere', async () => {
    previewPlan.mockRejectedValue(new SaoiApiError(409, 'used'))
    open()
    expect(await screen.findByText(/already been opened/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
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

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
const { takeArrivalPrelude } = await import('@/lib/planArrival')
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

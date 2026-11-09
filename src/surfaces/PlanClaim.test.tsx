import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SaoiApiError } from '@/api/client'

const claimPlan = vi.fn<(token: string) => Promise<unknown>>()

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isBackendConfigured: true,
}))
vi.mock('@/lib/session', () => ({ claimPlan: (token: string) => claimPlan(token) }))

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
})

describe('opening a plan link', () => {
  it('claims the token and hands over to the conversation', async () => {
    claimPlan.mockResolvedValue({})
    open('BBBBBBBBBBBBBBBBBBBBBB')
    expect(screen.getByRole('heading', { name: /opening your plan/i })).toBeInTheDocument()
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
    expect(claimPlan).toHaveBeenCalledWith('BBBBBBBBBBBBBBBBBBBBBB')
  })

  it('says a used link was opened elsewhere, and offers a fresh start', async () => {
    claimPlan.mockRejectedValue(new SaoiApiError(409, 'used'))
    open()
    expect(await screen.findByRole('heading', { name: /already been opened/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start a fresh conversation/i })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('says an expired link has expired', async () => {
    claimPlan.mockRejectedValue(new SaoiApiError(410, 'expired'))
    open()
    expect(await screen.findByRole('heading', { name: /expired/i })).toBeInTheDocument()
  })

  it('lets a busy refusal be tried again, since the link is not spent', async () => {
    claimPlan.mockRejectedValueOnce(new SaoiApiError(429, 'busy')).mockResolvedValueOnce({})
    open()
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }))
    await waitFor(() => expect(screen.getByText('the conversation')).toBeInTheDocument())
    expect(claimPlan).toHaveBeenCalledTimes(2)
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

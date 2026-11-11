import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { viaRequest } from '@/test/fetchStub'

vi.mock('@/lib/env', () => ({ saoiApiUrl: 'https://api.example.test/saoi' }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}))

const { useCaseHoldings, useCreateHolding, useUpdateHolding, useDeleteHolding } =
  await import('@/api/holdings')

const CASE = '22222222-2222-4222-8222-222222222222'
const HOLDING = {
  id: '55555555-5555-4555-8555-555555555555',
  kind: 'savings',
  label: 'BoI savings',
  provider: 'Bank of Ireland',
  productId: null,
  balance: 33000,
  ratePct: 3,
  monthlyAmountEur: 1000,
  fixedUntil: null,
  notedOn: '2026-11-11',
  source: 'plan',
  reminderId: null,
  createdAt: '2026-11-11T10:00:00.000Z',
  updatedAt: '2026-11-11T10:00:00.000Z',
}
const LINE =
  '€33,000 of €47,000 saved; at €1,000 a month that is February 2028, €2,000 ahead of the plan’s path.'
const PROGRESS = {
  goal: 'house_deposit',
  goalLabel: 'House deposit',
  savedNowEur: 33000,
  savedFrom: 'holdings',
  neededEur: 47000,
  monthlyEur: 1000,
  monthAtThisPace: '2028-02',
  planExpectedNowEur: 31000,
  differenceEur: 2000,
  line: LINE,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
let client: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const bodyOf = (init: RequestInit | undefined): unknown =>
  typeof init?.body === 'string' ? JSON.parse(init.body) : undefined

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchMock.mockReset()
  vi.stubGlobal('fetch', viaRequest(fetchMock))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCaseHoldings', () => {
  it('reads the holdings and the progress, parsed', async () => {
    fetchMock.mockResolvedValue(json({ holdings: [HOLDING], progress: PROGRESS }))
    const { result } = renderHook(() => useCaseHoldings(CASE), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.holdings[0]?.label).toBe('BoI savings')
    expect(result.current.data?.progress?.line).toBe(LINE)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/holdings`)
    expect(init?.method).toBe('GET')
  })

  it('does not read without a case, or until enabled', () => {
    renderHook(() => useCaseHoldings(null), { wrapper })
    renderHook(() => useCaseHoldings(CASE, { enabled: false }), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails loudly on a response that does not match the contract', async () => {
    fetchMock.mockResolvedValue(json({ holdings: 'nope', progress: null }))
    const { result } = renderHook(() => useCaseHoldings(CASE), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('the holdings mutations', () => {
  it('adds a holding, then reads the holdings and the reminders again', async () => {
    fetchMock.mockResolvedValue(json({ ...HOLDING, source: 'customer' }, 201))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateHolding(CASE), { wrapper })
    await act(() =>
      result.current.mutateAsync({ kind: 'savings', label: 'BoI savings', balance: 33000 }),
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/holdings`)
    expect(init?.method).toBe('POST')
    expect(bodyOf(init)).toEqual({ kind: 'savings', label: 'BoI savings', balance: 33000 })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['case', CASE, 'holdings'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['case', CASE, 'alerts'] })
  })

  it('changes a holding with only what changed', async () => {
    fetchMock.mockResolvedValue(json({ ...HOLDING, balance: 34000, ratePct: null }))
    const { result } = renderHook(() => useUpdateHolding(CASE), { wrapper })
    await act(() =>
      result.current.mutateAsync({
        holdingId: HOLDING.id,
        body: { balance: 34000, ratePct: null },
      }),
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/holdings/${HOLDING.id}`)
    expect(init?.method).toBe('PATCH')
    expect(bodyOf(init)).toEqual({ balance: 34000, ratePct: null })
  })

  it('deletes a holding, then reads the holdings again', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteHolding(CASE), { wrapper })
    await act(() => result.current.mutateAsync(HOLDING.id))
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/holdings/${HOLDING.id}`)
    expect(init?.method).toBe('DELETE')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['case', CASE, 'holdings'] })
  })

  it('surfaces the server’s refusal', async () => {
    fetchMock.mockResolvedValue(
      json({ ok: false, error: { code: 'not_found', message: 'No such holding.' } }, 404),
    )
    const { result } = renderHook(() => useDeleteHolding(CASE), { wrapper })
    await expect(result.current.mutateAsync(HOLDING.id)).rejects.toThrow('No such holding.')
  })
})

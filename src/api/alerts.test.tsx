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

const { useCaseAlerts, useCreateReminder, useDeleteReminder } = await import('@/api/alerts')

const CASE = '22222222-2222-4222-8222-222222222222'
const REMINDER = {
  id: '33333333-3333-4333-8333-333333333333',
  kind: 'fixed_rate_ends',
  label: 'AIB fixed rate',
  dueOn: '2027-03-01',
  productId: null,
  createdAt: '2026-11-11T10:00:00.000Z',
}
const ALERT = {
  id: '44444444-4444-4444-8444-444444444444',
  kind: 'rate_change',
  productId: 'savings.supersaver',
  reminderId: null,
  stage: null,
  title: 'A rate in your plan changed',
  body: 'SuperSaver: 3.00% to 2.75% from 10 Nov 2026. Your plan counted 3.00%.',
  data: {},
  createdAt: '2026-11-11T09:00:00.000Z',
  sentAt: null,
  seenAt: null,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
let client: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchMock.mockReset()
  vi.stubGlobal('fetch', viaRequest(fetchMock))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCaseAlerts', () => {
  it('reads the case’s alerts and reminders, parsed', async () => {
    fetchMock.mockResolvedValue(json({ alerts: [ALERT], reminders: [REMINDER] }))
    const { result } = renderHook(() => useCaseAlerts(CASE), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.reminders[0]?.label).toBe('AIB fixed rate')
    expect(result.current.data?.alerts[0]?.title).toBe('A rate in your plan changed')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/alerts`)
    expect(init?.method).toBe('GET')
  })

  it('does not read (and so mark seen) until enabled', () => {
    renderHook(() => useCaseAlerts(CASE, { enabled: false }), { wrapper })
    renderHook(() => useCaseAlerts(null), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails loudly on a response that does not match the contract', async () => {
    fetchMock.mockResolvedValue(json({ alerts: 'nope' }))
    const { result } = renderHook(() => useCaseAlerts(CASE), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateReminder', () => {
  it('posts the reminder and reads the list again', async () => {
    fetchMock.mockResolvedValue(json(REMINDER, 201))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateReminder(CASE), { wrapper })
    await act(() =>
      result.current.mutateAsync({
        kind: 'fixed_rate_ends',
        label: 'AIB fixed rate',
        dueOn: '2027-03-01',
      }),
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/reminders`)
    expect(init?.method).toBe('POST')
    expect(typeof init?.body === 'string' ? JSON.parse(init.body) : undefined).toEqual({
      kind: 'fixed_rate_ends',
      label: 'AIB fixed rate',
      dueOn: '2027-03-01',
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['case', CASE, 'alerts'] })
  })

  it('surfaces the server’s refusal', async () => {
    fetchMock.mockResolvedValue(
      json({ ok: false, error: { code: 'bad_request', message: 'That date has passed.' } }, 400),
    )
    const { result } = renderHook(() => useCreateReminder(CASE), { wrapper })
    await expect(
      result.current.mutateAsync({ kind: 'other', label: 'x', dueOn: '2020-01-01' }),
    ).rejects.toThrow('That date has passed.')
  })
})

describe('useDeleteReminder', () => {
  it('deletes the reminder and reads the list again', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteReminder(CASE), { wrapper })
    await act(() => result.current.mutateAsync(REMINDER.id))
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`https://api.example.test/saoi/api/cases/${CASE}/reminders/${REMINDER.id}`)
    expect(init?.method).toBe('DELETE')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['case', CASE, 'alerts'] })
  })

  it('surfaces a failed delete', async () => {
    fetchMock.mockResolvedValue(
      json({ ok: false, error: { code: 'not_found', message: 'No such reminder.' } }, 404),
    )
    const { result } = renderHook(() => useDeleteReminder(CASE), { wrapper })
    await expect(result.current.mutateAsync(REMINDER.id)).rejects.toThrow('No such reminder.')
  })
})

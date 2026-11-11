import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CaseAlertsResponse } from '@contracts/alerts.ts'

const fetchCaseAlerts = vi.fn<(caseId: string) => Promise<CaseAlertsResponse>>()
const deleteReminder = vi.fn<(caseId: string, reminderId: string) => Promise<void>>()

vi.mock('@/lib/saoiApi', () => ({
  fetchCaseAlerts: (caseId: string) => fetchCaseAlerts(caseId),
  deleteReminder: (caseId: string, reminderId: string) => deleteReminder(caseId, reminderId),
  createReminder: vi.fn(),
}))

const { RemindersSection } = await import('./RemindersSection')

const CASE = '22222222-2222-4222-8222-222222222222'

const reminder = (n: number, label: string, dueOn: string) => ({
  id: `33333333-3333-4333-8333-33333333333${String(n)}`,
  kind: 'fixed_rate_ends' as const,
  label,
  dueOn,
  productId: null,
  createdAt: '2026-11-11T10:00:00.000Z',
})

const alert = (n: number) => ({
  id: `44444444-4444-4444-8444-44444444444${String(n)}`,
  kind: 'rate_change' as const,
  productId: 'savings.supersaver',
  reminderId: null,
  stage: null,
  title: `Alert ${String(n)}`,
  body: `Body ${String(n)}`,
  data: {},
  createdAt: '2026-11-10T09:00:00.000Z',
  sentAt: null,
  seenAt: null,
})

function show(enabled = true) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RemindersSection caseId={CASE} enabled={enabled} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchCaseAlerts.mockReset()
  deleteReminder.mockReset()
})

describe('the menu’s Reminders section', () => {
  it('with nothing set, says how to set one', async () => {
    fetchCaseAlerts.mockResolvedValue({ alerts: [], reminders: [] })
    show()
    expect(
      await screen.findByText('No reminders yet. Tell Saoirse a date, or tap a chip.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Latest alerts' })).not.toBeInTheDocument()
  })

  it('lists reminders with their dates, and the last five alerts read-only', async () => {
    fetchCaseAlerts.mockResolvedValue({
      reminders: [reminder(1, 'AIB fixed rate', '2027-03-01')],
      alerts: [1, 2, 3, 4, 5, 6].map(alert),
    })
    show()
    const reminders = await screen.findByRole('list', { name: 'Your reminders' })
    expect(within(reminders).getByText('AIB fixed rate')).toBeInTheDocument()
    expect(within(reminders).getByText('1 Mar 2027')).toBeInTheDocument()

    const alerts = screen.getByRole('list', { name: 'Latest alerts' })
    expect(within(alerts).getAllByRole('listitem')).toHaveLength(5)
    expect(within(alerts).getByText('Alert 1')).toBeInTheDocument()
    expect(within(alerts).getByText('Body 1')).toBeInTheDocument()
    expect(within(alerts).getAllByText('10 Nov 2026')).toHaveLength(5)
    expect(within(alerts).queryByText('Alert 6')).not.toBeInTheDocument()
    expect(within(alerts).queryByRole('button')).not.toBeInTheDocument()
  })

  it('deletes a reminder and reads the list again', async () => {
    fetchCaseAlerts
      .mockResolvedValueOnce({
        reminders: [reminder(1, 'AIB fixed rate', '2027-03-01')],
        alerts: [],
      })
      .mockResolvedValue({ reminders: [], alerts: [] })
    deleteReminder.mockResolvedValue(undefined)
    show()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Delete the reminder for AIB fixed rate, 1 Mar 2027',
      }),
    )
    await waitFor(() =>
      expect(deleteReminder).toHaveBeenCalledWith(CASE, '33333333-3333-4333-8333-333333333331'),
    )
    expect(
      await screen.findByText('No reminders yet. Tell Saoirse a date, or tap a chip.'),
    ).toBeInTheDocument()
  })

  it('says so when the list will not load, with a way to try again', async () => {
    fetchCaseAlerts.mockRejectedValue(new Error('Saoirse is unavailable right now.'))
    show()
    expect(await screen.findByText(/Your reminders would not load/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('reads nothing while the menu is closed, because reading marks alerts seen', () => {
    show(false)
    expect(fetchCaseAlerts).not.toHaveBeenCalled()
  })
})

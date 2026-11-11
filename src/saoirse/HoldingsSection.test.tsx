import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  CaseHoldingsResponse,
  CreateHoldingBody,
  Holding,
  UpdateHoldingBody,
} from '@contracts/holdings.ts'

const fetchCaseHoldings = vi.fn<(caseId: string) => Promise<CaseHoldingsResponse>>()
const createHolding = vi.fn<(caseId: string, body: CreateHoldingBody) => Promise<Holding>>()
const updateHolding =
  vi.fn<(caseId: string, holdingId: string, body: UpdateHoldingBody) => Promise<Holding>>()
const deleteHolding = vi.fn<(caseId: string, holdingId: string) => Promise<void>>()

vi.mock('@/lib/saoiApi', () => ({
  fetchCaseHoldings: (caseId: string) => fetchCaseHoldings(caseId),
  createHolding: (caseId: string, body: CreateHoldingBody) => createHolding(caseId, body),
  updateHolding: (caseId: string, holdingId: string, body: UpdateHoldingBody) =>
    updateHolding(caseId, holdingId, body),
  deleteHolding: (caseId: string, holdingId: string) => deleteHolding(caseId, holdingId),
}))

const { HoldingsSection, NO_HOLDINGS } = await import('./HoldingsSection')

const CASE = '22222222-2222-4222-8222-222222222222'

const holding = (n: number, overrides: Partial<Holding>): Holding => ({
  id: `55555555-5555-4555-8555-55555555555${String(n)}`,
  kind: 'savings',
  label: `Holding ${String(n)}`,
  provider: null,
  productId: null,
  balance: 1000,
  ratePct: null,
  monthlyAmountEur: null,
  fixedUntil: null,
  notedOn: '2026-11-11',
  source: 'plan',
  reminderId: null,
  createdAt: '2026-11-11T10:00:00.000Z',
  updatedAt: '2026-11-11T10:00:00.000Z',
  ...overrides,
})

const SAVINGS = holding(1, {
  label: 'BoI savings',
  balance: 33000,
  ratePct: 3,
  monthlyAmountEur: 1000,
})
const DEPOSIT = holding(2, {
  kind: 'deposit',
  label: 'AIB deposit',
  balance: 10000,
  fixedUntil: '2027-03-01',
})
const LOAN = holding(3, { kind: 'car_finance', label: 'Car loan', balance: 6500, ratePct: 9 })

const LINE =
  '€33,000 of €47,000 saved; at €1,000 a month that is February 2028, €2,000 ahead of the plan’s path.'

function section() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HoldingsSection caseId={CASE} enabled />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchCaseHoldings.mockReset()
  createHolding.mockReset()
  updateHolding.mockReset()
  deleteHolding.mockReset()
})

describe('the menu’s Your money section', () => {
  it('groups the holdings as saved and owed, with the progress line above', async () => {
    fetchCaseHoldings.mockResolvedValue({
      holdings: [SAVINGS, DEPOSIT, LOAN],
      progress: {
        goal: 'house_deposit',
        goalLabel: 'House deposit',
        savedNowEur: 43000,
        savedFrom: 'holdings',
        neededEur: 47000,
        monthlyEur: 1000,
        monthAtThisPace: '2027-03',
        planExpectedNowEur: 41000,
        differenceEur: 2000,
        line: LINE,
      },
    })
    section()
    expect(await screen.findByText(LINE)).toBeInTheDocument()

    const saved = screen.getByRole('list', { name: 'Saved' })
    expect(within(saved).getByText('BoI savings')).toBeInTheDocument()
    expect(within(saved).getByText('€33,000')).toBeInTheDocument()
    expect(within(saved).getByText('3% · as of 11 Nov 2026')).toBeInTheDocument()
    expect(
      within(saved).getByText('fixed until 1 Mar 2027 · as of 11 Nov 2026'),
    ).toBeInTheDocument()

    const owed = screen.getByRole('list', { name: 'Owed' })
    expect(within(owed).getByText('Car loan')).toBeInTheDocument()
    expect(within(owed).getByText('€6,500')).toBeInTheDocument()
    expect(within(owed).queryByText('BoI savings')).not.toBeInTheDocument()
  })

  it('says nothing is entered yet, without a progress line when there is none', async () => {
    fetchCaseHoldings.mockResolvedValue({ holdings: [], progress: null })
    section()
    expect(await screen.findByText(NO_HOLDINGS)).toBeInTheDocument()
    expect(NO_HOLDINGS).toBe('Nothing entered yet. Tell Saoirse what you have, or add it here.')
    expect(screen.queryByRole('list', { name: 'Saved' })).not.toBeInTheDocument()
  })

  it('says when the list would not load, with a way to try again', async () => {
    fetchCaseHoldings.mockRejectedValue(new Error('Network down.'))
    section()
    expect(
      await screen.findByText('Your accounts and debts would not load. Network down.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('adds a holding from the inline form and reads the list again', async () => {
    fetchCaseHoldings.mockResolvedValue({ holdings: [], progress: null })
    createHolding.mockResolvedValue(holding(4, { label: 'Credit union', balance: 2500.5 }))
    section()
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Credit union' } })
    fireEvent.change(screen.getByLabelText('Balance (€)'), { target: { value: '2500.50' } })
    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(createHolding).toHaveBeenCalledWith(CASE, {
        kind: 'savings',
        label: 'Credit union',
        balance: 2500.5,
        ratePct: 1.5,
      }),
    )
    await waitFor(() => expect(fetchCaseHoldings).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
  })

  it('does not add without a name and a balance', async () => {
    fetchCaseHoldings.mockResolvedValue({ holdings: [], progress: null })
    section()
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Give it a name, such as “BoI savings”.')).toBeInTheDocument()
    expect(screen.getByText('Enter the balance in euro.')).toBeInTheDocument()
    expect(createHolding).not.toHaveBeenCalled()
  })

  it('edits a holding, sending only what changed, and clears an emptied rate', async () => {
    fetchCaseHoldings.mockResolvedValue({ holdings: [SAVINGS], progress: null })
    updateHolding.mockResolvedValue({ ...SAVINGS, balance: 34000, ratePct: null })
    section()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit BoI savings' }))

    expect(screen.getByLabelText('Name')).toHaveValue('BoI savings')
    fireEvent.change(screen.getByLabelText('Balance (€)'), { target: { value: '34000' } })
    fireEvent.change(screen.getByLabelText('Rate (%)'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateHolding).toHaveBeenCalledWith(CASE, SAVINGS.id, {
        balance: 34000,
        ratePct: null,
      }),
    )
  })

  it('shows a failed edit and keeps the form open', async () => {
    fetchCaseHoldings.mockResolvedValue({ holdings: [SAVINGS], progress: null })
    updateHolding.mockRejectedValue(new Error('Too large.'))
    section()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit BoI savings' }))
    fireEvent.change(screen.getByLabelText('Balance (€)'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('That was not saved. Too large.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('deletes a holding and reads the list again', async () => {
    fetchCaseHoldings.mockResolvedValue({ holdings: [SAVINGS, LOAN], progress: null })
    deleteHolding.mockResolvedValue(undefined)
    section()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Car loan' }))
    await waitFor(() => expect(deleteHolding).toHaveBeenCalledWith(CASE, LOAN.id))
    await waitFor(() => expect(fetchCaseHoldings).toHaveBeenCalledTimes(2))
  })

  it('does not read until the menu is open', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HoldingsSection caseId={CASE} enabled={false} />
      </QueryClientProvider>,
    )
    expect(fetchCaseHoldings).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { TurnEntry } from '@/saoirse/useConversation'

const send = vi.fn<(message: string) => Promise<void>>()
let entries: TurnEntry[] = []

vi.mock('@/saoirse/useConversation', () => ({
  useConversation: () => ({
    entries,
    streaming: false,
    error: null,
    send: (message: string) => send(message),
    loadFrom: vi.fn(),
    resettle: vi.fn(),
    reset: vi.fn(),
  }),
}))

const { SaoirseChat } = await import('./SaoirseChat')
const { arrivalFollowUps } = await import('@/lib/planArrival')

const PRELUDE = {
  welcome: 'Hi, I’m Saoirse.',
  notice: ['A note on your data.'],
  accepted: 'That’s fine, carry on',
  routeCount: 0,
  hasDeposit: false,
}

function chat(hasDeposit: boolean) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SaoirseChat
          prelude={{ ...PRELUDE, hasDeposit }}
          arrivalFollowUps={arrivalFollowUps(0, hasDeposit)}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue(undefined)
  entries = [{ kind: 'message', id: 'm1', author: 'assistant', text: 'Here is your comparison.' }]
})

describe('the reminder chips after a saved comparison opens', () => {
  it('offers the fixed-rate reminder, and a tap sends the sentence as the customer', () => {
    chat(false)
    const chip = screen.getByRole('button', { name: 'Remind me when my fixed rate ends' })
    expect(
      screen.queryByRole('button', { name: 'Remind me when my deposit matures' }),
    ).not.toBeInTheDocument()
    fireEvent.click(chip)
    expect(send).toHaveBeenCalledWith('Remind me when my fixed rate ends')
  })

  it('offers the deposit reminder when the plan holds a deposit', () => {
    chat(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remind me when my deposit matures' }))
    expect(send).toHaveBeenCalledWith('Remind me when my deposit matures')
  })
})

describe('the holdings chips after a saved comparison opens', () => {
  it.each([
    ['Add what I have saved', 'Here is what I have saved: '],
    ['Add a debt', 'Here is what I owe: '],
  ])('“%s” starts the sentence in the composer and sends nothing', (label, draft) => {
    chat(false)
    fireEvent.click(screen.getByRole('button', { name: label }))
    const box = screen.getByRole('textbox', { name: 'Message Saoirse' })
    expect(box.textContent).toBe(draft)
    expect(box).toHaveFocus()
    expect(send).not.toHaveBeenCalled()
    // The chips stay until something is sent, so the other one can still be chosen.
    expect(screen.getByRole('button', { name: 'Add a debt' })).toBeInTheDocument()
  })
})

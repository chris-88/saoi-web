import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Composer } from '@/saoirse/Composer'
import { reloadBlocked } from '@/app/reloadGate'

describe('Composer', () => {
  it('holds a new build back while a message is half written, and lets go once it is sent', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} hint={false} />)
    const box = screen.getByRole('textbox', { name: 'Message Saoirse' })
    expect(reloadBlocked(false)).toBe(false)

    box.textContent = 'How much can I borrow'
    fireEvent.input(box)
    expect(reloadBlocked(false)).toBe(true)
    // Gone to another app: the new build may load.
    expect(reloadBlocked(true)).toBe(false)

    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('How much can I borrow')
    expect(reloadBlocked(false)).toBe(false)
  })
})

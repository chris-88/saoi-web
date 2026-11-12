import { describe, expect, it } from 'vitest'
import { handSaoirseLine, takeFirstMessage, takeSaoirseLine, withSaoirseLine } from './planArrival'

describe('planArrival', () => {
  it('hands Saoirse’s line over once, separately from a first message', () => {
    handSaoirseLine('Moving the keys to March 2028 means €6,000 less saved by then.')
    expect(takeFirstMessage()).toBeNull()
    expect(takeSaoirseLine()).toBe('Moving the keys to March 2028 means €6,000 less saved by then.')
    expect(takeSaoirseLine()).toBeNull()
  })

  it('puts the carried line under the history, as Saoirse’s', () => {
    const history = [
      { kind: 'message', id: 'm1', author: 'customer', text: 'About €40,000' },
    ] as const
    expect(withSaoirseLine(history, null)).toBe(history)
    expect(withSaoirseLine(history, 'The reading.')).toEqual([
      ...history,
      { kind: 'message', id: 'carried-saoirse-line', author: 'assistant', text: 'The reading.' },
    ])
  })
})

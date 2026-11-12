import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { holdReload, reloadBlocked, reloadWhenSafe, useReloadHold } from '@/app/reloadGate'

/** A document whose visibility the test moves. */
class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
  become(state: DocumentVisibilityState): void {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

const releases: (() => void)[] = []
const hold = (kind: 'draft' | 'streaming'): (() => void) => {
  const release = holdReload(kind)
  releases.push(release)
  return release
}

afterEach(() => {
  for (const release of releases.splice(0)) release()
})

describe('reloadWhenSafe', () => {
  it('reloads at once when nothing is held', () => {
    const reload = vi.fn()
    reloadWhenSafe(reload, new FakeDocument() as unknown as Document)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('waits for a half-written message to be sent or cleared', () => {
    const doc = new FakeDocument()
    const reload = vi.fn()
    const release = hold('draft')

    reloadWhenSafe(reload, doc as unknown as Document)
    expect(reload).not.toHaveBeenCalled()

    release()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('lets a draft go once the page is hidden, and reloads only once', () => {
    const doc = new FakeDocument()
    const reload = vi.fn()
    const release = hold('draft')

    reloadWhenSafe(reload, doc as unknown as Document)
    doc.become('hidden')
    expect(reload).toHaveBeenCalledTimes(1)

    release()
    doc.become('visible')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never cuts a streaming reply off, hidden or not', () => {
    const doc = new FakeDocument()
    const reload = vi.fn()
    const release = hold('streaming')

    reloadWhenSafe(reload, doc as unknown as Document)
    doc.become('hidden')
    expect(reloadBlocked(true)).toBe(true)
    expect(reload).not.toHaveBeenCalled()

    release()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('waits for every hold, not the first released', () => {
    const doc = new FakeDocument()
    const reload = vi.fn()
    const streaming = hold('streaming')
    const draft = hold('draft')

    reloadWhenSafe(reload, doc as unknown as Document)
    streaming()
    expect(reload).not.toHaveBeenCalled()
    draft()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('useReloadHold', () => {
  it('holds while active and lets go when it turns off or unmounts', () => {
    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => {
        useReloadHold('draft', active)
      },
      { initialProps: { active: false } },
    )
    expect(reloadBlocked(false)).toBe(false)

    rerender({ active: true })
    expect(reloadBlocked(false)).toBe(true)

    rerender({ active: false })
    expect(reloadBlocked(false)).toBe(false)

    rerender({ active: true })
    unmount()
    expect(reloadBlocked(false)).toBe(false)
  })
})

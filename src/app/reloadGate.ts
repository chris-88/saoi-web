import { useEffect } from 'react'

/**
 * What a reload would cost the customer right now.
 *
 * A new build reloads the page when its worker takes over (`reloadWhenWorkerTakesOver`), and an
 * installed app looks for one every time it comes back into view and every hour. Most of the
 * time nobody notices. Two moments they would: a message half written in the composer, which a
 * reload wipes, and a reply still streaming in, which a reload cuts off. Each surface reports its
 * own moment here, and the reload waits for it to pass.
 *
 *  - `draft`: text in the composer. Waits until it is sent or cleared, or until the page is
 *    hidden (the customer has gone elsewhere, and coming back to the new build is the point).
 *  - `streaming`: a reply in flight. Waits until it has finished, hidden or not.
 */
export type ReloadHold = 'draft' | 'streaming'

type Hold = { readonly kind: ReloadHold }

const holds = new Set<Hold>()
const listeners = new Set<() => void>()

/** Hold reloads until the returned function is called. Calling it twice is harmless. */
export function holdReload(kind: ReloadHold): () => void {
  const hold: Hold = { kind }
  holds.add(hold)
  return () => {
    if (!holds.delete(hold)) return
    for (const listener of [...listeners]) listener()
  }
}

/** Whether a reload now would lose something, given whether the page is hidden. */
export function reloadBlocked(hidden: boolean): boolean {
  for (const hold of holds) {
    if (hold.kind === 'streaming' || !hidden) return true
  }
  return false
}

/**
 * Reload now if nothing is held, otherwise as soon as nothing is.
 *
 * Looked at again whenever a hold is released and whenever the page is shown or hidden.
 */
export function reloadWhenSafe(reload: () => void, doc: Document = document): void {
  const hidden = (): boolean => doc.visibilityState === 'hidden'
  if (!reloadBlocked(hidden())) {
    reload()
    return
  }

  const retry = (): void => {
    if (reloadBlocked(hidden())) return
    listeners.delete(retry)
    doc.removeEventListener('visibilitychange', retry)
    reload()
  }
  listeners.add(retry)
  doc.addEventListener('visibilitychange', retry)
}

/** Hold reloads of `kind` while `active` is true; released when it turns false or on unmount. */
export function useReloadHold(kind: ReloadHold, active: boolean): void {
  useEffect(() => {
    if (!active) return
    return holdReload(kind)
  }, [kind, active])
}

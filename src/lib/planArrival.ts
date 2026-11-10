/**
 * What the arrival from a saved comparison said before the claim, handed to the chat that
 * opens after it (2026-11-10, "everything happens inside the chat").
 *
 * The welcome and the data notice are Saoirse's messages, shown before anything is stored,
 * so they exist only in this browser tab. Kept in memory for the one hand-over to the chat
 * and taken once: a reload shows the conversation as the server holds it.
 */
export type ArrivalPrelude = {
  readonly welcome: string
  readonly notice: readonly string[]
  readonly accepted: string
}

let pending: ArrivalPrelude | null = null

export function handArrivalToChat(prelude: ArrivalPrelude): void {
  pending = prelude
}

export function takeArrivalPrelude(): ArrivalPrelude | null {
  const prelude = pending
  pending = null
  return prelude
}

/** "Hi, I'm Saoirse. I've got the comparison you were working on: buying a home by November 2028." */
export function welcomeLine(title: string): string {
  const goal = title.length === 0 ? title : `${title.charAt(0).toLowerCase()}${title.slice(1)}`
  return `Hi, I’m Saoirse. I’ve got the comparison you were working on: ${goal}.`
}

export const ACCEPT_LABEL = 'That’s fine, carry on'

/** The quick replies under Saoirse's line once the comparison is open. */
export const ARRIVAL_FOLLOW_UPS = [
  { id: 'through', label: 'Talk me through these' },
  { id: 'figure', label: 'Change a figure' },
  { id: 'how', label: 'How was this worked out?' },
] as const

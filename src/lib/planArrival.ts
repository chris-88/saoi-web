/**
 * The arrival from a saved comparison, handed to the chat that opens after it (2026-11-12,
 * build 1 of the first-home experience).
 *
 * The arrival shows the card, the notice box and Saoirse's one question before anything is
 * stored. The customer's first message claims the plan; the claim writes the card and the
 * question as Saoirse's first message on the server, and the chat then sends what they typed as
 * the first turn. Only that message crosses over, in memory, taken once: a reload shows the
 * conversation as the server holds it.
 */
let pending: string | null = null

export function handFirstMessage(message: string): void {
  pending = message
}

export function takeFirstMessage(): string | null {
  const message = pending
  pending = null
  return message
}

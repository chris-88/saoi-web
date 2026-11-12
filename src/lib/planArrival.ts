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

/**
 * Saoirse's line on arrival when the server sent none (an API from before 2026-11-12). The
 * server owns the wording now (`opening` on the preview, the same line it writes at the claim);
 * this mirrors its fallback for plans without a hook question.
 */
export const ARRIVAL_FALLBACK_LINE =
  'Your comparison is here, with every figure as you left it. What would you like to look at first?'

/** What Saoirse says first on arrival: the server's line, else the hook question, else the fallback. */
export function openingLine(preview: {
  readonly opening?: string | undefined
  readonly arrival: { readonly hookQuestion: { readonly question: string } | null } | null
}): string {
  return preview.opening ?? preview.arrival?.hookQuestion?.question ?? ARRIVAL_FALLBACK_LINE
}

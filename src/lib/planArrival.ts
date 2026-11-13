import type { HistoryEntry } from '@domain/card-state.ts'

/**
 * What crosses into the chat that opens next, in memory, taken once: a reload shows the
 * conversation as the server holds it.
 *
 * Two things cross this way, one in each voice:
 *
 * - The customer's first message on a saved comparison's arrival (2026-11-12, build 1 of the
 *   first-home experience). The arrival shows the card, the notice box and Saoirse's one
 *   question before anything is stored. The customer's first message claims the plan; the claim
 *   writes the card and the question as Saoirse's first message on the server, and the chat then
 *   sends what they typed as the first turn.
 * - Saoirse's reading of a plan edit (build 4): one factual sentence of what the edit changed,
 *   shown as Saoirse's line the moment the chat opens. Nothing is sent in the customer's name;
 *   the server has written a `plan_edited` event, and the chat's return turn reads it.
 *
 * And one thing for the customer to send or not: a line put in the composer, unsent, from
 * "Change" on a plan choice under Your plan ("Show me the options for my monthly saving
 * again", 2026-11-13). It is theirs to edit, send or delete.
 */
let pending: string | null = null
let saoirseLine: string | null = null
let composerLine: string | null = null

export function handFirstMessage(message: string): void {
  pending = message
}

export function takeFirstMessage(): string | null {
  const message = pending
  pending = null
  return message
}

export function handSaoirseLine(line: string): void {
  saoirseLine = line
}

export function takeSaoirseLine(): string | null {
  const line = saoirseLine
  saoirseLine = null
  return line
}

export function handComposerLine(line: string): void {
  composerLine = line
}

export function takeComposerLine(): string | null {
  const line = composerLine
  composerLine = null
  return line
}

/**
 * The conversation as the server holds it, with Saoirse's carried line after it: the newest
 * thing said, under everything said before. Local only; the server keeps the event, not the
 * sentence.
 */
export function withSaoirseLine(
  history: readonly HistoryEntry[],
  line: string | null,
): readonly HistoryEntry[] {
  if (line === null) return history
  return [
    ...history,
    { kind: 'message', id: 'carried-saoirse-line', author: 'assistant', text: line },
  ]
}

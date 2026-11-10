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
  /** How many routes to a home the comparison carries; 0 for none. */
  readonly routeCount: number
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

/**
 * "Hi, I'm Saoirse. I've got the comparison you were working on: buying a home by November 2028."
 * A home plan with routes adds the count once: "…, and 6 routes to a home."
 */
export function welcomeLine(title: string, routeCount = 0): string {
  const goal = title.length === 0 ? title : `${title.charAt(0).toLowerCase()}${title.slice(1)}`
  const routes =
    routeCount > 0
      ? `, and ${String(routeCount)} route${routeCount === 1 ? '' : 's'} to a home`
      : ''
  return `Hi, I’m Saoirse. I’ve got the comparison you were working on: ${goal}${routes}.`
}

export const ACCEPT_LABEL = 'That’s fine, carry on'

const FOLLOW_UPS = [
  { id: 'through', label: 'Talk me through these' },
  { id: 'figure', label: 'Change a figure' },
  { id: 'how', label: 'How was this worked out?' },
] as const

const ROUTES_FOLLOW_UP = { id: 'routes', label: 'Tell me about the other routes' } as const

/** The quick replies under Saoirse's line once the comparison is open; the routes one only with routes. */
export function arrivalFollowUps(
  routeCount: number,
): readonly { readonly id: string; readonly label: string }[] {
  return routeCount > 0 ? [...FOLLOW_UPS, ROUTES_FOLLOW_UP] : FOLLOW_UPS
}

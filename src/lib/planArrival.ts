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
  /** Whether the comparison holds a term deposit, for the "deposit matures" reminder chip. */
  readonly hasDeposit: boolean
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

/**
 * What the data notice (`NOTICE` in `planClaim.ts`) and the privacy page say about reminders
 * and plan alerts (2026-11-11).
 */
export const REMINDERS_NOTICE_LINE =
  'Reminders you set and alerts about your plan are kept on your case until you delete them or the case is deleted.'

export const ACCEPT_LABEL = 'That’s fine, carry on'

const FOLLOW_UPS = [
  { id: 'through', label: 'Talk me through these' },
  { id: 'figure', label: 'Change a figure' },
  { id: 'how', label: 'How was this worked out?' },
] as const

const ROUTES_FOLLOW_UP = { id: 'routes', label: 'Tell me about the other routes' } as const

/**
 * The reminder chips (plan alerts, 2026-11-11). A tap sends the sentence as the customer's
 * message; Saoirse asks for the date and sets the reminder with its `set_reminder` tool, so the
 * app has no date picker of its own.
 */
export const FIXED_RATE_REMINDER = {
  id: 'remind-fixed',
  label: 'Remind me when my fixed rate ends',
} as const
export const DEPOSIT_REMINDER = {
  id: 'remind-deposit',
  label: 'Remind me when my deposit matures',
} as const

/**
 * Whether a saved comparison's products include a term deposit. The preview names its products
 * but not their category, so this reads the name: the market's term deposits are all called
 * "… Fixed Term Deposit" or "… Fixed Term Account".
 */
export function hasDepositProduct(products: readonly { readonly name: string }[]): boolean {
  return products.some((product) => /\bdeposit\b|\bfixed term\b/i.test(product.name))
}

/**
 * The quick replies under Saoirse's line once the comparison is open: the routes one only with
 * routes, the fixed-rate reminder always, the deposit reminder only with a deposit in the plan.
 */
export function arrivalFollowUps(
  routeCount: number,
  hasDeposit = false,
): readonly { readonly id: string; readonly label: string }[] {
  return [
    ...FOLLOW_UPS,
    ...(routeCount > 0 ? [ROUTES_FOLLOW_UP] : []),
    FIXED_RATE_REMINDER,
    ...(hasDeposit ? [DEPOSIT_REMINDER] : []),
  ]
}

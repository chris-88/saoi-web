import { z } from 'zod'
import type { PreviewPlanResponse } from '@contracts/session.ts'
import { SaoiApiError } from '@/lib/saoiApi'

/**
 * Why a link did not open, as the server answered it.
 *
 * `stale` is the one the server did not cause: it answered, and this page's build could not read
 * the answer (a Zod contract that no longer matches). That is an old page after a release, not a
 * network failure, and "try again" on the same page cannot fix it; a reload can.
 */
export type ClaimProblem = 'unknown' | 'used' | 'expired' | 'busy' | 'failed' | 'stale'

export function problemOf(error: unknown): ClaimProblem {
  if (error instanceof z.ZodError) return 'stale'
  if (!(error instanceof SaoiApiError)) return 'failed'
  switch (error.status) {
    case 400:
    case 404:
      return 'unknown'
    case 409:
      return 'used'
    case 410:
      return 'expired'
    case 429:
      return 'busy'
    default:
      return 'failed'
  }
}

/** What Saoirse says when a link cannot be opened, in the chat. */
export const PROBLEM_LINES: Record<ClaimProblem, string> = {
  unknown:
    'That link didn’t work: it isn’t one Saoi gave out. If you copied it, check it came across whole, or ask your AI assistant to save the comparison again. Or we can start again here.',
  used: 'This link was opened on another device. If you signed in to Saoi there, sign in here and your conversation is in your list.',
  expired:
    'That link has expired: a saved comparison is kept for 24 hours, then deleted unless it’s opened. Ask your AI assistant to save it again, or we can start again here.',
  busy: 'Saoi is busy right now, and your link hasn’t been used up. Try it again in a few minutes.',
  failed: 'I couldn’t open your comparison just now. Try the link again in a moment.',
  stale:
    'This page is an older version of Saoi and can’t open your comparison. Reload to get the latest version.',
}

/**
 * What opening a plan link leads to (2026-11-14, the card as the way back in).
 *
 * - `preview`: a plan nobody has opened yet. The arrival shows it, and the first message claims.
 * - `reopened`: a plan this browser opened before. The preview refuses any claimed plan, so the
 *   claim is tried at once; the server recognises the browser and puts it back into that
 *   conversation. Nothing new is recorded and nothing is said.
 * - `inAnotherAccount`: claimed by somebody else while this browser is signed in. Signing in
 *   again cannot help: the conversation is in the account that opened the link.
 *
 * Anything else is thrown: a claim that answers 409 to a browser that is not signed in is the
 * used-elsewhere state, which offers to sign in.
 */
export type Arrival =
  | { readonly kind: 'preview'; readonly preview: PreviewPlanResponse }
  | { readonly kind: 'reopened' }
  | { readonly kind: 'inAnotherAccount' }

export type ArrivalSteps = {
  readonly preview: (token: string) => Promise<PreviewPlanResponse>
  readonly claim: (token: string) => Promise<{ readonly reopened: boolean }>
  /** Whether this browser is signed in to an account, not just an anonymous visitor. */
  readonly signedIn: () => Promise<boolean>
}

export async function arrive(token: string, steps: ArrivalSteps): Promise<Arrival> {
  try {
    return { kind: 'preview', preview: await steps.preview(token) }
  } catch (error) {
    if (problemOf(error) !== 'used') throw error
  }
  try {
    /*
     * The claim of a claimed plan only ever reopens: the server answers `reopened` or 409, and
     * never spends anything (saoi `routes/plans`, `reopen`).
     */
    await steps.claim(token)
    return { kind: 'reopened' }
  } catch (error) {
    if (problemOf(error) === 'used' && (await steps.signedIn())) return { kind: 'inAnotherAccount' }
    throw error
  }
}

/**
 * The one line the conversations list shows when a plan link led there: signed in, and the link
 * was opened by another account. Carried as router state, so it shows once, on that visit.
 */
export const IN_ANOTHER_ACCOUNT_LINE =
  'The conversation from that link is in the account that opened it, not this one.'

const inAnotherAccountStateSchema = z.object({ planInAnotherAccount: z.literal(true) })

export const inAnotherAccountState: z.infer<typeof inAnotherAccountStateSchema> = {
  planInAnotherAccount: true,
}

export function cameFromPlanInAnotherAccount(state: unknown): boolean {
  return inAnotherAccountStateSchema.safeParse(state).success
}

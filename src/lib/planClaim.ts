import { SaoiApiError } from '@/lib/saoiApi'

/** Why a link did not open, as the server answered it. */
export type ClaimProblem = 'unknown' | 'used' | 'expired' | 'busy' | 'failed'

export function problemOf(error: unknown): ClaimProblem {
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

export const CLAIM_COPY: Record<ClaimProblem, { readonly title: string; readonly body: string }> = {
  unknown: {
    title: 'That link didn’t work',
    body: 'It isn’t a plan link Saoi gave out. If you copied it, check it came across whole, or ask your assistant to save the plan again.',
  },
  used: {
    title: 'This plan has already been opened',
    body: 'Each link opens once, so the plan is in whichever browser or app opened it first. If that was you on another device, sign in there to keep it, or ask your assistant to save the plan again for a fresh link.',
  },
  expired: {
    title: 'This link has expired',
    body: 'A plan is held for 24 hours, then deleted unless opened. Ask your assistant to build the plan again for a fresh link.',
  },
  busy: {
    title: 'Saoi is busy right now',
    body: 'Your link hasn’t been used up. Try it again in a few minutes.',
  },
  failed: {
    title: 'Something went wrong',
    body: 'Your plan couldn’t be opened just now. Try the link again in a moment.',
  },
}

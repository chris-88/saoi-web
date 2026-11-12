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

/** What Saoirse says when a link cannot be opened, in the chat. */
export const PROBLEM_LINES: Record<ClaimProblem, string> = {
  unknown:
    'That link didn’t work: it isn’t one Saoi gave out. If you copied it, check it came across whole, or ask your AI assistant to save the comparison again. Or we can start again here.',
  used: 'That comparison has already been opened, in whichever browser or app opened it first. Ask your AI assistant to save it again for a fresh link, or we can start again here.',
  expired:
    'That link has expired: a saved comparison is kept for 24 hours, then deleted unless it’s opened. Ask your AI assistant to save it again, or we can start again here.',
  busy: 'Saoi is busy right now, and your link hasn’t been used up. Try it again in a few minutes.',
  failed: 'I couldn’t open your comparison just now. Try the link again in a moment.',
}

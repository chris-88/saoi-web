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

/**
 * The data notice, as Saoirse says it in the chat before a saved comparison is opened
 * (2026-11-10). Facts from the privacy page (`surfaces/Privacy.tsx`) and the infra;
 * "[To confirm: ...]" marks what is not settled in any repo yet and is Chris's to decide.
 */
export const NOTICE = {
  lines: [
    'Before I open it, a quick note on your data.',
    'I keep the figures and preferences in this comparison, and our chat, so I don’t ask twice. It’s stored on Saoi’s own servers in Ireland.',
    'To write my replies, the chat is sent to Anthropic, whose service is in the United States. Nothing is sold, or shared for marketing.',
    'Each run of the home calculator keeps one anonymous record: the day, an income band, how many months to the keys (banded), whether the date is met, and the county, rent band, kind of home and first-time buyer if given. No figures, no names, nothing that identifies you.',
    'You can ask for a copy of what Saoi holds, or for it to be deleted, at any time: baz@chrisquinn.ie.',
  ],
  full: [
    {
      label: 'How long',
      text: 'An unopened comparison is deleted 24 hours after it was saved. Once you carry on: [To confirm: how long an opened comparison and its chat are kept]. Conversations are also cleared regularly while Saoi is a prototype, and one is deleted whenever you ask.',
    },
    {
      label: 'Who is responsible',
      text: '[To confirm: the data controller’s name and address]. Contact: baz@chrisquinn.ie.',
    },
    {
      label: 'Diagnostics',
      text: 'When something breaks, Sentry may receive a conversation id and what the safety check decided, never what you typed.',
    },
    {
      label: 'Cookies',
      text: 'None for tracking, and no analytics or advertising. Your sign-in and a few preferences stay in your browser’s own storage.',
    },
    {
      label: 'Not advice, not regulated',
      text: 'Saoi compares products on the figures you give. It is not regulated by the Central Bank of Ireland and does not give advice.',
    },
  ],
} as const

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

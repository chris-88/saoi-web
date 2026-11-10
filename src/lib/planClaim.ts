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
    body: 'It isn’t a link Saoi gave out. If you copied it, check it came across whole, or ask your AI assistant to save the comparison again.',
  },
  used: {
    title: 'This comparison has already been opened',
    body: 'Each link opens once, so it is in whichever browser or app opened it first. If that was you on another device, sign in there to keep it, or ask your AI assistant to save the comparison again for a fresh link.',
  },
  expired: {
    title: 'This link has expired',
    body: 'A saved comparison is held for 24 hours, then deleted unless opened. Ask your AI assistant to save it again for a fresh link, or start a chat with Saoirse here.',
  },
  busy: {
    title: 'Saoi is busy right now',
    body: 'Your link hasn’t been used up. Try it again in a few minutes.',
  },
  failed: {
    title: 'Something went wrong',
    body: 'Your comparison couldn’t be opened just now. Try the link again in a moment.',
  },
}

/**
 * The data notice shown before a saved comparison is opened (2026-11-10). Facts from the
 * privacy page (`surfaces/Privacy.tsx`) and the infra; "[To confirm: ...]" marks what is not
 * settled in any repo yet and is Chris's to decide.
 */
export const NOTICE = {
  title: 'Before you continue',
  lead: 'Opening this comparison stores it with Saoi and starts a chat with Saoirse, Saoi’s assistant. Here is what that means.',
  points: [
    {
      label: 'What Saoi keeps',
      text: 'The figures and preferences in this comparison, and your chat with Saoirse, including the notes she takes so she does not ask twice.',
    },
    {
      label: 'Why',
      text: 'To show you the comparison and let Saoirse talk it through. Nothing is sold, and nothing is shared with banks or anyone else for marketing.',
    },
    {
      label: 'Where',
      text: 'On Saoi’s own servers in Ireland. To write Saoirse’s replies, the chat is sent to Anthropic, whose service is in the United States.',
    },
    {
      label: 'Your rights',
      text: 'You can ask for a copy of what Saoi holds about you, or for it to be deleted, at any time: baz@chrisquinn.ie.',
    },
  ],
  full: [
    {
      label: 'How long',
      text: 'An unopened comparison is deleted 24 hours after it was saved. Once you continue: [To confirm: how long an opened comparison and its chat are kept]. Conversations are also cleared regularly while Saoi is a prototype, and one is deleted whenever you ask.',
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

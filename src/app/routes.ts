/**
 * Every surface's path in one place. Hash routing: GitHub Pages has no rewrites.
 *
 * The customer's surfaces. The operator's console is its own app at admin.saoi.ie
 * (`chris-88/saoi-admin`); `/admin/*` here redirects there.
 *
 * There used to be more. There was a replica of a bank website and an
 * authenticated app behind a simulated login, which was a lot of scaffolding around the only
 * thing worth showing — a conversation that understands what someone is trying to do.
 */
/** The pages under You, in the order they are listed there. */
export const YOU_SECTIONS = [
  'money',
  'reminders',
  'notifications',
  'linked',
  'conversations',
] as const
export type YouSection = (typeof YOU_SECTIONS)[number]

export function isYouSection(value: string): value is YouSection {
  return (YOU_SECTIONS as readonly string[]).includes(value)
}

export const routes = {
  /**
   * Saoirse itself, and the front door: the app opens straight on the chat. The marketing landing
   * moved to saoi.ie. `/baz` still redirects here, for links and installs that have it.
   */
  saoirse: '/',

  /** What happens to what somebody types. Linked from the notice card and the landing page. */
  privacy: '/privacy',

  /**
   * You: who is signed in, and everything about the conversation that is not the conversation
   * (your money, reminders, notifications, linked accounts, the switcher, feedback). Behind
   * the avatar in the chat header; each part is a page of its own.
   */
  you: '/you',
  youSection: (section: YouSection | ':section' = ':section') => `/you/${section}`,

  /** Questions and offers to work on this, from a phone. */
  ask: '/ask',

  /** §33 — a second applicant, arriving on a single-use link. */
  partnerJoin: (token = ':token') => `/join/${token}`,

  /** A plan made in the customer's own AI, opened from its one-time link. */
  planClaim: (token = ':token') => `/plan/${token}`,
} as const

/**
 * The showcase, the explainer and the article are their own site (`chris-88/saoi-showcase`).
 * The old paths here redirect to it, and in-product links point at it directly.
 */
export const showcaseUrls = {
  showcase: 'https://showcase.saoi.ie/#/',
  howItWorks: (section?: string) =>
    `https://showcase.saoi.ie/#/how-it-works${section ? `/${section}` : ''}`,
  article: 'https://showcase.saoi.ie/#/article',
} as const

/**
 * The presenter console is its own site (`chris-88/saoi-admin`). Its routes sit at the root
 * there, so `/admin/case/x` here becomes `#/case/x` there.
 */
export const adminUrl = (rest = ''): string => `https://admin.saoi.ie/#/${rest.replace(/^\/+/, '')}`

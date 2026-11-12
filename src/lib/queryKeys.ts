/**
 * The single source of query keys (CLAUDE.md > TanStack Query). Realtime handlers
 * invalidate by these keys; they never write to the cache.
 */
export const queryKeys = {
  /** Who is signed in, as far as the browser knows. */
  identity: () => ['identity'] as const,

  session: {
    current: () => ['session', 'current'] as const,
    /** The conversation switcher's list. Invalidated whenever a conversation is switched. */
    cases: () => ['session', 'cases'] as const,
  },

  case: {
    all: () => ['case'] as const,
    detail: (caseId: string) => ['case', caseId] as const,
    digest: (caseId: string) => ['case', caseId, 'digest'] as const,
    facts: (caseId: string) => ['case', caseId, 'facts'] as const,
    messages: (caseId: string) => ['case', caseId, 'messages'] as const,
    events: (caseId: string) => ['case', caseId, 'events'] as const,
    participants: (caseId: string) => ['case', caseId, 'participants'] as const,
    productInterests: (caseId: string) => ['case', caseId, 'product-interests'] as const,
    metrics: (caseId: string) => ['case', caseId, 'metrics'] as const,
    /** Accounts linked through Nexus, for the "Linked accounts" page under You. */
    linkedAccounts: (caseId: string) => ['case', caseId, 'linked-accounts'] as const,
    /** Plan alerts and the open reminders, for the "Reminders" page under You. */
    alerts: (caseId: string) => ['case', caseId, 'alerts'] as const,
    /** Accounts and debts entered by hand, and progress on the plan ("Your money", the plan card). */
    holdings: (caseId: string) => ['case', caseId, 'holdings'] as const,
    /** The claimed plan as the profile shows and edits it ("Your plan" under You). */
    plan: (caseId: string) => ['case', caseId, 'plan'] as const,
  },

  plans: {
    forCase: (caseId: string) => ['case', caseId, 'plans'] as const,
    /** Opening a plan link. Run once per token: the claim spends it. */
    claim: (token: string) => ['plan-claim', token] as const,
    /** What a saved comparison shows before it is opened; reading it spends nothing. */
    preview: (token: string) => ['plan-preview', token] as const,
  },
  applications: {
    forCase: (caseId: string) => ['case', caseId, 'applications'] as const,
    progress: (caseId: string, applicationIds: string) =>
      ['case', caseId, 'applications', 'progress', applicationIds] as const,
    detail: (applicationId: string) => ['application', applicationId] as const,
    outstanding: (applicationId: string) => ['application', applicationId, 'outstanding'] as const,
    requests: (applicationId: string) => ['application', applicationId, 'requests'] as const,
  },

  partner: {
    tasks: (token: string) => ['partner', token, 'tasks'] as const,
    applications: (token: string) => ['partner', token, 'applications'] as const,
  },

  admin: {
    cases: (period: string = 'all') => ['admin', 'cases', period] as const,
    caseInspection: (caseId: string) => ['admin', 'case', caseId] as const,
    persona: () => ['admin', 'persona'] as const,
    domainConfig: () => ['admin', 'domain-config'] as const,
    audienceMetrics: () => ['admin', 'audience-metrics'] as const,
    catalogue: () => ['admin', 'catalogue-overrides'] as const,
    products: () => ['admin', 'product-catalogue'] as const,
    rates: () => ['admin', 'mortgage-rates'] as const,
    analytics: (period: string) => ['admin', 'analytics', period] as const,
    /** §44: what people said about it, and who asked to work on it. */
    feedback: (period: string) => ['admin', 'feedback', period] as const,
    collaborators: () => ['admin', 'collaborators'] as const,
  },
} as const

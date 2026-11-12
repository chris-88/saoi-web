import { z } from 'zod'

/**
 * The plan on a case, as the profile reads and edits it (2026-11-12, build 4 of the first-home
 * experience): `GET` and `PATCH /api/cases/{caseId}/plan`.
 *
 * A hand-typed stand-in for the contract agreed with the backend (saoi `feat/plan-edit`), kept
 * here until that contract is in `saoi`'s `_shared` and synced into `src/shared` like the rest.
 * When it is, this file goes and the imports move to `@contracts/*`.
 */

export const PROPERTY_KINDS = ['new_build', 'second_hand', 'self_build'] as const
export type PropertyKind = (typeof PROPERTY_KINDS)[number]

/** A calendar month, `YYYY-MM`. */
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const planEditableSchema = z.object({
  targetDate: month.nullable(),
  homePrice: z.number().nullable(),
  monthlySaving: z.number().nullable(),
  propertyKind: z.enum(PROPERTY_KINDS).nullable(),
  firstTimeBuyer: z.boolean().nullable(),
  buyingTogether: z.boolean().nullable(),
})
export type PlanEditable = z.infer<typeof planEditableSchema>
export type PlanField = keyof PlanEditable

export const casePlanSchema = z.object({
  planId: z.string(),
  title: z.string(),
  editable: planEditableSchema,
  summary: z.object({
    keysOn: month.nullable(),
    neededAtKeysEur: z.number().nullable(),
    savedEur: z.number().nullable(),
    progressLine: z.string().nullable(),
  }),
  /** The plan's top options, at most three. */
  watched: z
    .array(z.object({ lead: z.string(), kind: z.string(), value: z.string(), figure: z.string() }))
    .max(3),
  updatedAt: z.string(),
})
export type CasePlan = z.infer<typeof casePlanSchema>

/** The edited plan, and one factual sentence of what the edit changed. */
export const planEditResponseSchema = casePlanSchema.extend({ reading: z.string().min(1) })
export type PlanEditResponse = z.infer<typeof planEditResponseSchema>

/** At least one field; the server refuses an empty body. */
export type PlanEditBody = Partial<PlanEditable>

export const PROPERTY_KIND_LABELS = {
  new_build: 'New build',
  second_hand: 'Second-hand',
  self_build: 'Self-build',
} as const satisfies Record<PropertyKind, string>

/** "€48,000": whole euro, as the plan's own cards show them. */
export function eur(value: number): string {
  return `€${Math.round(value).toLocaleString('en-IE')}`
}

/** "March 2028" for a `YYYY-MM` month. */
export function monthLabel(month: string): string {
  const [year = 0, index = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** This month as `YYYY-MM`, in the customer's own time zone. */
export function currentMonth(today: Date = new Date()): string {
  return `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

/** The month the keys are planned for: the plan's own reading, else the date they gave. */
export function keysMonth(plan: CasePlan): string | null {
  return plan.summary.keysOn ?? plan.editable.targetDate
}

/** "Keys March 2028 · €12,000 of €48,000 saved", or what there is of it. */
export function planStateLine(plan: CasePlan): string | undefined {
  const keys = keysMonth(plan)
  const { savedEur, neededAtKeysEur } = plan.summary
  const parts = [
    keys === null ? null : `Keys ${monthLabel(keys)}`,
    savedEur === null || neededAtKeysEur === null
      ? null
      : `${eur(savedEur)} of ${eur(neededAtKeysEur)} saved`,
  ].filter((part) => part !== null)
  return parts.length === 0 ? undefined : parts.join(' · ')
}

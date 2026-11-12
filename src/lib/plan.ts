import type { PLAN_PROPERTY_KINDS } from '@contracts/market-plan.ts'
import type { CasePlan, PlanEditable } from '@contracts/case-plan.ts'

/**
 * The plan on a case, as the profile reads and edits it (2026-11-12, build 4 of the first-home
 * experience): `GET` and `PATCH /api/cases/{caseId}/plan`. The contract is the backend's
 * (`@contracts/case-plan.ts`); this file holds how the app words and orders it.
 */

export type PropertyKind = (typeof PLAN_PROPERTY_KINDS)[number]
export type PlanField = keyof PlanEditable

/** The order the segmented control offers them in. */
export const PROPERTY_KINDS = [
  'new_build',
  'second_hand',
  'self_build',
] as const satisfies readonly PropertyKind[]

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

/** A home plan has a price; any other plan's is null (the contract's own rule). */
export function isHomePlan(plan: CasePlan): boolean {
  return plan.editable.homePrice !== null
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
    keys === null ? null : `${isHomePlan(plan) ? 'Keys' : 'By'} ${monthLabel(keys)}`,
    savedEur === null || neededAtKeysEur === null
      ? null
      : `${eur(savedEur)} of ${eur(neededAtKeysEur)} saved`,
  ].filter((part) => part !== null)
  return parts.length === 0 ? undefined : parts.join(' · ')
}

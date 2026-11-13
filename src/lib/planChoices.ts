import { z } from 'zod'
import { casePlanEditedSchema, casePlanSchema, type CasePlan } from '@contracts/case-plan.ts'
import { eur } from '@/lib/plan'

/**
 * The products the customer has chosen for their plan (Chris, 2026-11-13: "the goal is to get
 * the customer to pick products from the product lists we're presenting, so that we have a goal
 * in mind of what they're going to do").
 *
 * One choice per slot: where their lump sum goes, where the monthly saving goes, and the
 * mortgage. The choice is the customer's own tap (`POST /api/cases/{caseId}/plan/choices`), never
 * Saoirse's; the server keeps it on the claimed plan and narrates it on the next turn.
 *
 * Typed by hand here until the backend's `feat/plan-choices` deploys (saoi
 * `_shared/contracts/case-plan.ts`): then `npm run shared:sync` and `npm run api:generate` bring
 * the same shapes into `@contracts`, and these schemas give way to them. Reading `choices` with a
 * default keeps today's server (which sends none) parsing as "nothing chosen yet".
 */

export const PLAN_CHOICE_SLOTS = ['lump_sum', 'monthly_saving', 'mortgage'] as const
export type PlanChoiceSlot = (typeof PLAN_CHOICE_SLOTS)[number]

export const planChoiceSchema = z.object({
  slot: z.enum(PLAN_CHOICE_SLOTS),
  /** The products row's id the customer chose (`<provider>:<productId>`, `held:<n>`). */
  rowId: z.string(),
  lead: z.string(),
  providerId: z.string().optional(),
  /** "instant access", "3-year fixed". */
  kind: z.string(),
  /** The headline, as the card showed it: "3.11%", "€1,751/mo". */
  value: z.string(),
  /** The money in their figures: "€815 by Jul 2028". */
  figure: z.string(),
  chosenAt: z.string(),
})
export type PlanChoice = z.infer<typeof planChoiceSchema>

export const planChoicesSchema = z.object({
  lump_sum: planChoiceSchema.nullable(),
  monthly_saving: planChoiceSchema.nullable(),
  mortgage: planChoiceSchema.nullable(),
})
export type PlanChoices = z.infer<typeof planChoicesSchema>

export const NO_CHOICES: PlanChoices = { lump_sum: null, monthly_saving: null, mortgage: null }

/** The plan read with its choices (`GET`, `PATCH`, and the choices routes all return it). */
export const casePlanReadSchema = casePlanSchema.extend({
  choices: planChoicesSchema.default(NO_CHOICES),
})
export type CasePlanRead = z.infer<typeof casePlanReadSchema>

export const casePlanEditedReadSchema = casePlanEditedSchema.extend({
  choices: planChoicesSchema.default(NO_CHOICES),
})

/** What `POST …/plan/choices` takes. */
export const planChoiceRequestSchema = z.object({
  slot: z.enum(PLAN_CHOICE_SLOTS),
  rowId: z.string().trim().min(1).max(160),
})
export type PlanChoiceRequest = z.infer<typeof planChoiceRequestSchema>

/** The plan's figures a slot is worded in; nothing where there is no plan. */
type Figures = Pick<CasePlan, 'editable' | 'summary'> | null | undefined

function amountOf(slot: PlanChoiceSlot, plan: Figures): number | null {
  if (plan === null || plan === undefined) return null
  switch (slot) {
    case 'lump_sum': {
      const saved = plan.summary.savedEur
      return saved !== null && saved > 0 ? saved : null
    }
    case 'monthly_saving': {
      const monthly = plan.editable.monthlySaving
      return monthly !== null && monthly > 0 ? monthly : null
    }
    case 'mortgage':
      return null
  }
}

/**
 * A slot in the customer's own figures, in their voice ("My €32,000", "My €1,000 a month",
 * "My mortgage") or the app's ("Your …"); plain words where the plan has no figure.
 */
export function slotName(slot: PlanChoiceSlot, plan: Figures, voice: 'My' | 'Your'): string {
  const amount = amountOf(slot, plan)
  switch (slot) {
    case 'lump_sum':
      return amount === null ? `${voice} lump sum` : `${voice} ${eur(amount)}`
    case 'monthly_saving':
      return amount === null ? `${voice} monthly saving` : `${voice} ${eur(amount)} a month`
    case 'mortgage':
      return `${voice} mortgage`
  }
}

/** The badge on a chosen row or column, in short words: "your €32,000", "your monthly saving". */
export function slotBadge(slot: PlanChoiceSlot, plan: Figures): string {
  switch (slot) {
    case 'lump_sum': {
      const amount = amountOf(slot, plan)
      return amount === null ? 'your lump sum' : `your ${eur(amount)}`
    }
    case 'monthly_saving':
      return 'your monthly saving'
    case 'mortgage':
      return 'your mortgage'
  }
}

/**
 * What "Change" (or, for an open slot, "See options") puts in the composer: the customer asking
 * for that slot's options, "again" when they have already chosen from them.
 */
export function changeLine(slot: PlanChoiceSlot, again = true): string {
  const what = { lump_sum: 'lump sum', monthly_saving: 'monthly saving', mortgage: 'mortgage' }[
    slot
  ]
  return `Show me the options for my ${what}${again ? ' again' : ''}`
}

/**
 * The slot a row is chosen for, if any, from the live plan rather than the card's own `chosen`:
 * a card stored before the choice was made still shows it, and one replaced since does not.
 * (The card's `chosen` is also dropped by today's card contract until `shared:sync`.)
 */
export function chosenSlotOf(
  rowId: string,
  choices: PlanChoices | null | undefined,
): PlanChoiceSlot | null {
  if (choices === null || choices === undefined) return null
  return PLAN_CHOICE_SLOTS.find((slot) => choices[slot]?.rowId === rowId) ?? null
}

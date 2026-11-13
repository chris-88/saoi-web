import { PLAN_CHOICE_SLOTS, type PlanChoiceSlot } from '@contracts/market-plan.ts'
import type { CasePlan, CasePlanChoices } from '@contracts/case-plan.ts'
import { eur } from '@/lib/plan'

/**
 * How the app words the products the customer has chosen for their plan (Chris, 2026-11-13:
 * "the goal is to get the customer to pick products from the product lists we're presenting,
 * so that we have a goal in mind of what they're going to do").
 *
 * One choice per slot: where their lump sum goes, where the monthly saving goes, and the
 * mortgage. The choice is the customer's own tap (`POST /api/cases/{caseId}/plan/choices`), never
 * Saoirse's; the server keeps it on the claimed plan (`CasePlan.choices`) and narrates it on the
 * next turn. The shapes are the backend's (`@contracts/case-plan.ts`, `@contracts/market-plan.ts`).
 */

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
 * The slot a row is chosen for, if any, from the live plan rather than the card's own `chosen`
 * (stamped when the card was stored): a card shown before the choice was made still shows it,
 * and one replaced since does not.
 */
export function chosenSlotOf(
  rowId: string,
  choices: CasePlanChoices | null | undefined,
): PlanChoiceSlot | null {
  if (choices === null || choices === undefined) return null
  return PLAN_CHOICE_SLOTS.find((slot) => choices[slot]?.rowId === rowId) ?? null
}

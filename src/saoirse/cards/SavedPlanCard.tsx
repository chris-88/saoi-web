import type { ReactNode } from 'react'
import type { Card as CardPayload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { routesOf, type PlanRoute } from '@/lib/planRoutes'
import { PlanArrivalCard } from '@/saoirse/cards/PlanArrivalCard'
import { PlanRoutes } from '@/saoirse/cards/PlanRoutes'
import { useCaseHoldings } from '@/api/holdings'

type Payload = Extract<CardPayload, { type: 'saved_plan' }>

/**
 * A comparison the customer saved in their own AI, opened here.
 *
 * A home plan saved from 2026-11-12 carries `arrival`, what the host's card showed, and is drawn
 * as that card (`PlanArrivalCard`), the same on the arrival screen and in the conversation.
 * Anything older, or without a home goal, is the compact card (Chris, 2026-11-10: the full
 * card overwhelmed): the goal and date, their figures in one line, and the first three options
 * as one line each, in the order they chose. Everything else comes up in the conversation when
 * they ask; Saoirse's context holds all of it. Every line is the server's, built from the stored
 * plan.
 */
export function SavedPlanCard({
  card,
  caseId = null,
}: {
  card: Payload
  /** The conversation the card is in; with none, no progress is read. */
  caseId?: string | null
}): ReactNode {
  const progress = caseId === null ? null : <PlanProgressLine caseId={caseId} />
  if (card.arrival !== undefined) {
    return (
      <PlanArrivalCard
        arrival={card.arrival}
        routes={routesOf(card)}
        progressLine={progress === null ? undefined : <div className="px-4 pb-3">{progress}</div>}
      />
    )
  }
  return <CompactPlanCard plan={card} progressLine={progress} />
}

/**
 * Where the plan stands now, from the case's holdings (2026-11-11): the server's one factual
 * line, or nothing when the plan has no deposit or debt goal, or while it loads or fails (the
 * card's own figures still stand). Mounted only with a case, so nothing is fetched without one.
 */
function PlanProgressLine({ caseId }: { caseId: string }): ReactNode {
  const holdings = useCaseHoldings(caseId)
  const line = holdings.data?.progress?.line
  if (line === undefined) return null
  return <p className="text-muted-foreground text-xs leading-snug">{line}</p>
}

/** What the compact card reads: the saved-plan card, or a plan preview shaped like one. */
export type CompactPlan = {
  readonly title: string
  readonly figures?: string | undefined
  readonly comparison?: Payload['comparison'] | undefined
  readonly products: readonly {
    readonly name: string
    readonly providerName: string
    readonly amounts: readonly string[]
    readonly rate: string | null
  }[]
  readonly routes: readonly PlanRoute[]
}

/** The goal, their figures in one line, and the first three options, one line each. */
export function CompactPlanCard({
  plan,
  progressLine = null,
}: {
  plan: CompactPlan
  progressLine?: ReactNode
}): ReactNode {
  const comparison = plan.comparison
  /** The sorted-by figure, named once above the rows so each row stays one short line. */
  const by =
    comparison === undefined
      ? null
      : comparison.sortBy === 'monthly_repayment'
        ? 'monthly repayment'
        : comparison.sortBy === 'keys_date'
          ? 'keys date'
          : '5-year cost'
  const shortKind = (kind: string): string => kind.replace('-year fixed', '-yr fixed')
  const rows: { key: string; left: string; right: string; unconfirmed: boolean }[] =
    comparison !== undefined
      ? comparison.options.map((option, index) => ({
          key: String(index),
          left: `${option.lender} · ${shortKind(option.kind)}`,
          right: (option.lead ?? option.fiveYear).replace(/ \/ 5 yrs$| over 5 years$/, ''),
          unconfirmed: !option.confirmed,
        }))
      : plan.products.slice(0, 3).map((product, index) => ({
          key: String(index),
          left: `${product.providerName} · ${product.name}`,
          right: product.amounts[0] ?? product.rate ?? '',
          unconfirmed: false,
        }))
  const anyUnconfirmed = rows.some((row) => row.unconfirmed)

  return (
    <div className="space-y-2">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="space-y-1 px-4 pt-3.5 pb-3">
          <h3 className="text-sm font-semibold text-balance">{plan.title}</h3>
          {plan.figures !== undefined && plan.figures !== '' && (
            <p className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {plan.figures}
            </p>
          )}
          {progressLine}
          {comparison !== undefined && by !== null && (
            <p className="text-muted-foreground text-xs">
              First {String(Math.min(3, comparison.total))} of {String(comparison.total)}, by {by}
            </p>
          )}
        </div>
        {rows.length > 0 && (
          <ol
            className="divide-y border-t px-4"
            aria-label={comparison !== undefined ? 'The first three options' : 'In the comparison'}
          >
            {rows.map((row) => (
              <li key={row.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {row.left}
                  {row.unconfirmed && (
                    <span className="text-muted-foreground" aria-label="not confirmed">
                      *
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">
                  {row.right}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="text-muted-foreground space-y-0.5 border-t px-4 py-2 text-[11px] leading-snug">
          {anyUnconfirmed && <p>* Incentives from CCPC, not confirmed on the lender’s site.</p>}
          <p>Information, not advice. Saoi is not regulated by the Central Bank of Ireland.</p>
        </div>
      </Card>
      <PlanRoutes routes={plan.routes} />
    </div>
  )
}

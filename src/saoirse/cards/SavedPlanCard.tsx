import type { ReactNode } from 'react'
import type { Card as CardPayload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { routesOf } from '@/lib/planRoutes'
import { PlanRoutes } from '@/saoirse/cards/PlanRoutes'

type Payload = Extract<CardPayload, { type: 'saved_plan' }>

/**
 * A comparison the customer saved in their own AI, opened here.
 *
 * Compact on purpose (Chris, 2026-11-10: the full card overwhelmed): the goal and date, their
 * figures in one line, and the first three options as one line each, in the order they chose.
 * Everything else (the rest of the options, conditions, the savings split, how it was worked
 * out) comes up in the conversation when they ask; Saoirse's context holds all of it. Every
 * line is the server's, built from the stored plan. A home plan's routes follow the card, three
 * then the rest on a tap (2026-11-10), when the card carries them.
 */
export function SavedPlanCard({ card }: { card: Payload }): ReactNode {
  const comparison = card.comparison
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
      : card.products.slice(0, 3).map((product, index) => ({
          key: String(index),
          left: `${product.providerName} · ${product.name}`,
          right: product.amounts[0] ?? product.rate ?? '',
          unconfirmed: false,
        }))
  const anyUnconfirmed = rows.some((row) => row.unconfirmed)
  const routes = routesOf(card)

  return (
    <div className="space-y-2">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="space-y-1 px-4 pt-3.5 pb-3">
          <h3 className="text-sm font-semibold text-balance">{card.title}</h3>
          {card.figures !== undefined && card.figures !== '' && (
            <p className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {card.figures}
            </p>
          )}
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
      <PlanRoutes routes={routes} />
    </div>
  )
}

import type { ReactNode } from 'react'
import { House, Landmark, PiggyBank, type LucideIcon } from 'lucide-react'
import type { PlanArrivalView } from '@contracts/market-plan.ts'
import { Card } from '@/components/ui/card'
import type { PlanRoute } from '@/lib/planRoutes'
import { PlanRoutes } from '@/saoirse/cards/PlanRoutes'

/**
 * The card the customer saw in their own AI, as the app's own card (2026-11-12, build 1 of the
 * first-home experience: "the two sides of the jump look like one thing").
 *
 * The same figures in the same order as the host's calculator card (saoi-mcp
 * `homeCalculatorApp.ts`, `planView` and `routesView`), without its button: the month the money
 * is in place, large; what that money is made of; saved against needed; three tiles (Savings,
 * Mortgage, Could afford); what was assumed; then "Other supports". Every figure and word comes
 * from the server's `arrival` block; the app words only the meter. Tiles name a rate and a
 * count, never a lender or a product.
 */
export function PlanArrivalCard({
  arrival,
  routes,
  progressLine,
}: {
  arrival: PlanArrivalView
  routes: readonly PlanRoute[]
  /** Where the plan stands now, from the case's holdings, once it is in a conversation. */
  progressLine?: ReactNode
}): ReactNode {
  return (
    <div className="space-y-2">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="space-y-1 px-4 pt-4 pb-3">
          <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            Ready to buy
          </p>
          <p className="text-3xl leading-tight font-semibold tracking-tight">{arrival.readyLine}</p>
          {arrival.readyNote !== null && (
            <p className="text-muted-foreground text-xs">{arrival.readyNote}</p>
          )}
          {arrival.factParts.length > 0 && (
            <p className="text-muted-foreground pt-0.5 text-sm tabular-nums">
              {arrival.factParts.map((part, index) => (
                <span key={part}>
                  {index > 0 && ' '}
                  <span className="whitespace-nowrap">{part}</span>
                </span>
              ))}
            </p>
          )}
        </div>

        {arrival.progress !== null && <Meter progress={arrival.progress} />}
        {progressLine}

        {arrival.tiles.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 border-t px-3 py-3" aria-label="At a glance">
            {arrival.tiles.map((tile, index) => (
              <Tile key={tile.label} tile={tile} icon={TILE_ICONS[index] ?? House} />
            ))}
          </ul>
        )}

        <div className="text-muted-foreground space-y-0.5 border-t px-4 py-2 text-[11px] leading-snug">
          {arrival.assumptions.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>Information, not advice. Saoi is not regulated by the Central Bank of Ireland.</p>
        </div>
      </Card>
      <PlanRoutes routes={routes} variant="supports" />
    </div>
  )
}

/** Savings, Mortgage, Could afford: the host card's icons, by position. */
const TILE_ICONS: readonly LucideIcon[] = [PiggyBank, Landmark, House]

const eur = (value: number): string => `€${Math.round(value).toLocaleString('en-IE')}`

/** Saved now against the money needed at the keys, as the host card's meter words it. */
function Meter({ progress }: { progress: NonNullable<PlanArrivalView['progress']> }): ReactNode {
  const { savedEur, neededEur, monthlySavingEur } = progress
  const covered = savedEur >= neededEur
  const pct = covered || neededEur === 0 ? 100 : Math.round((savedEur / neededEur) * 1000) / 10
  return (
    <div className="space-y-1 px-4 pb-3">
      <div
        role="progressbar"
        aria-label="Deposit saved towards the money needed at the keys"
        aria-valuemin={0}
        aria-valuemax={Math.round(neededEur)}
        aria-valuenow={Math.round(Math.min(savedEur, neededEur))}
        className="bg-muted h-1.5 overflow-hidden rounded-full"
      >
        <span
          className="bg-primary block h-full rounded-full"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <p className="text-xs tabular-nums">
        {eur(savedEur)} of {eur(neededEur)}
      </p>
      <p className="flex justify-between gap-3 text-xs tabular-nums">
        <span className="text-muted-foreground">{eur(monthlySavingEur)} a month</span>
        <span className="font-medium">
          {covered ? 'Covered' : `${eur(neededEur - savedEur)} to go`}
        </span>
      </p>
    </div>
  )
}

function Tile({
  tile,
  icon: Icon,
}: {
  tile: PlanArrivalView['tiles'][number]
  icon: LucideIcon
}): ReactNode {
  return (
    <li className="bg-muted/50 min-w-0 space-y-0.5 rounded-lg p-2">
      <Icon aria-hidden className="text-muted-foreground size-4" />
      <p className="text-muted-foreground text-[11px]">{tile.label}</p>
      <p className="text-sm leading-tight font-semibold tabular-nums">{tile.value}</p>
      {tile.lines.slice(0, 2).map((line) => (
        <p key={line} className="text-muted-foreground text-[11px] leading-snug tabular-nums">
          {line}
        </p>
      ))}
    </li>
  )
}

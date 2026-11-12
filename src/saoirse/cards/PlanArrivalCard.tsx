import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, House, Landmark, PiggyBank, type LucideIcon } from 'lucide-react'
import type { PlanArrivalView } from '@contracts/market-plan.ts'
import { Card } from '@/components/ui/card'
import type { PlanRoute } from '@/lib/planRoutes'
import { cn } from '@/lib/utils'
import { PlanRoutes } from '@/saoirse/cards/PlanRoutes'

/**
 * The card the customer saw in their own AI, as the app's own card (2026-11-12, build 1 of the
 * first-home experience: "the two sides of the jump look like one thing").
 *
 * The same figures in the same order as the host's calculator card (saoi-mcp
 * `homeCalculatorApp.ts`, `planView` and `routesView`), without its button: the month the money
 * is in place, large; what that money is made of; saved against needed; three tiles (Savings,
 * Mortgage, Could afford); what was assumed; then "Other supports". Every figure and word comes
 * from the server's `arrival` block; the app words only the meter and lays the tiles out. Tiles
 * name a rate and a count, never a lender or a product.
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

        {arrival.tiles.length > 0 && <Tiles tiles={arrival.tiles} />}

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

type TileView = PlanArrivalView['tiles'][number]

/**
 * The three tiles in one row at 390px (Chris, 2026-11-12): the icon beside the label, the
 * qualifier ("up to") on its own small row above the value, never on the value's line, and both
 * rows a fixed height, so the three headline figures start at the same height whether a tile has
 * a qualifier or not. `sub` is secondary (between the value and muted); only `quiet` is the small quiet
 * count. A tile with `detail` is a button that opens those lines in a panel under the row, one
 * at a time, with a chevron because it is tappable; a tile without is not, and has none.
 */
function Tiles({ tiles }: { tiles: readonly TileView[] }): ReactNode {
  const [open, setOpen] = useState<number | null>(null)
  const baseId = useId()
  const panelId = (index: number): string => `${baseId}-detail-${String(index)}`
  return (
    <div className="border-t px-2 py-2">
      <ul className="grid grid-cols-3 gap-1" aria-label="At a glance">
        {tiles.map((tile, index) => (
          <li key={tile.label} className="flex min-w-0">
            <Tile
              tile={tile}
              icon={TILE_ICONS[index] ?? House}
              expanded={open === index}
              controls={panelId(index)}
              onToggle={() => {
                setOpen((current) => (current === index ? null : index))
              }}
            />
          </li>
        ))}
      </ul>
      {tiles.map((tile, index) =>
        tile.detail.length === 0 ? null : (
          <div
            key={tile.label}
            id={panelId(index)}
            role="region"
            aria-label={tile.label}
            hidden={open !== index}
            className="bg-muted/50 mt-1 space-y-1 rounded-lg px-3 py-2.5"
          >
            {tile.detail.map((line) => (
              <p key={line} className="text-foreground/75 text-xs leading-snug">
                {line}
              </p>
            ))}
          </div>
        ),
      )}
    </div>
  )
}

function Tile({
  tile,
  icon: Icon,
  expanded,
  controls,
  onToggle,
}: {
  tile: TileView
  icon: LucideIcon
  expanded: boolean
  controls: string
  onToggle: () => void
}): ReactNode {
  const expandable = tile.detail.length > 0
  const quiet = tile.quiet[0]
  const body = (
    <>
      <span className="text-muted-foreground flex h-4 items-center gap-1 text-2xs">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{tile.label}</span>
      </span>
      <span className="text-muted-foreground mt-1 block h-4 text-2xs">{tile.qualifier}</span>
      <span className="block text-[15px] leading-5 font-semibold tracking-tight whitespace-nowrap tabular-nums">
        {tile.value}
      </span>
      {/* One block per server string, so a line breaks only between them; a string wraps
          inside itself only when it is wider than the tile. Foreground at 75%: darker than the
          quiet count in light, lighter than the value in dark. */}
      {tile.sub.slice(0, 2).map((line) => (
        <span
          key={line}
          className="text-foreground/75 mt-0.5 block text-xs leading-snug tabular-nums"
        >
          {line}
        </span>
      ))}
      {/* The foot: the quiet count, and the chevron when the tile opens (kept off the label's
          row, where it cut "Could afford" short at 390px). */}
      {(quiet !== undefined || expandable) && (
        <span className="mt-auto flex items-end justify-between gap-1 pt-0.5">
          <span className="text-muted-foreground min-w-0 text-2xs tabular-nums">{quiet}</span>
          {expandable && (
            <ChevronDown
              aria-hidden
              className={cn(
                'text-muted-foreground size-3.5 shrink-0 transition-transform',
                expanded && 'rotate-180',
              )}
            />
          )}
        </span>
      )}
    </>
  )
  const box = 'bg-muted/50 flex w-full min-w-0 flex-col rounded-lg px-1.5 py-2 text-left'
  if (!expandable) return <div className={box}>{body}</div>
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        box,
        'hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
        expanded && 'bg-muted ring-border ring-1',
      )}
    >
      {body}
    </button>
  )
}

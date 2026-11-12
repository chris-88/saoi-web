import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { MarketProductsCard as Payload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Row = Payload['rows'][number]

/**
 * The product card that follows the question asked (2026-11-12, build 3 of the first-home
 * experience, spec section 4).
 *
 * The server arranges the rows by what the question implies (their own account against the
 * market, by access, by the date that fits the keys, a mortgage by the sort they chose) and the
 * card names that arrangement first, with the line that says how to ask for it another way. Then
 * one line per product: the lead, its kind, the headline value on the right, the supporting
 * figure under it. How it was worked out is folded behind one line; the statement closes the card.
 *
 * Every word and figure is the server's; the card only lays them out and puts the customer's own
 * account first. Nothing here is a pick: the customer asks in the chat for more, or for another
 * arrangement, so the only control on the card is the fold.
 */
export function MarketProductsCard({ card }: { card: Payload }): ReactNode {
  // Stable sort: the server's order, with the customer's own account lifted to the top.
  const rows = [...card.rows].sort((a, b) => Number(b.held) - Number(a.held))
  const anyUnconfirmed = rows.some((row) => !row.confirmed)

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="space-y-1 px-4 pt-3.5 pb-3">
        <h3 className="text-sm font-semibold text-balance">{card.arrangement.title}</h3>
        <p className="text-foreground/75 text-xs leading-snug">{card.arrangement.line}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground border-t px-4 py-3 text-xs">
          Nothing in the market matches this.
        </p>
      ) : (
        <ol className="divide-y border-t px-4" aria-label={card.arrangement.title}>
          {rows.map((row) => (
            <ProductRow key={row.id} row={row} />
          ))}
        </ol>
      )}

      {card.more > 0 && (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs tabular-nums">
          {card.more === 1 ? '1 more; ask to see it' : `${String(card.more)} more; ask to see them`}
        </p>
      )}

      <Basis basis={card.basis} />

      <div className="text-muted-foreground space-y-0.5 border-t px-4 py-2 text-[11px] leading-snug">
        {/* `confirmed: false` is a rate or incentive resting on CCPC's figure alone. */}
        {anyUnconfirmed && <p>* From CCPC only, not confirmed on the provider’s own site.</p>}
        <p>{card.statement}</p>
      </div>
    </Card>
  )
}

function ProductRow({ row }: { row: Row }): ReactNode {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-medium">{row.lead}</span>
          {!row.confirmed && (
            <span className="text-muted-foreground" aria-label="not confirmed">
              *
            </span>
          )}
          {row.held && (
            <Badge
              variant="secondary"
              className="ml-1.5 px-1.5 py-0 align-text-bottom text-2xs font-normal"
            >
              yours
            </Badge>
          )}
          {/* The kind moves to its own line whole rather than breaking inside itself. */}{' '}
          <span className="text-muted-foreground text-xs whitespace-nowrap">· {row.kind}</span>
        </p>
        <p className="text-foreground/75 mt-0.5 text-xs leading-snug tabular-nums">{row.figure}</p>
        {row.note !== null && (
          <p className="text-muted-foreground mt-0.5 text-2xs leading-snug">{row.note}</p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
        {row.value}
      </span>
    </li>
  )
}

/** The basis statement (duty-of-care standard 2.4), folded: detail only when asked. */
function Basis({ basis }: { basis: Payload['basis'] }): ReactNode {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current)
        }}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs outline-none focus-visible:ring-[3px]"
      >
        How this was worked out
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label="How this was worked out"
        hidden={!open}
        className="space-y-2 px-4 pb-3"
      >
        <BasisPart label="Figures used" lines={basis.figures} />
        <BasisPart label="Arranged by" lines={[basis.objective]} />
        <BasisPart label="Assumed" lines={basis.assumptions} />
        <BasisPart label="Covered" lines={[basis.coverage]} />
        <BasisPart label="Warnings" lines={basis.warnings} />
      </div>
    </div>
  )
}

function BasisPart({ label, lines }: { label: string; lines: readonly string[] }): ReactNode {
  const shown = lines.filter((line) => line !== '')
  if (shown.length === 0) return null
  return (
    <div>
      <p className="text-muted-foreground text-2xs font-medium tracking-wider uppercase">{label}</p>
      <ul className="mt-0.5 space-y-0.5">
        {shown.map((line) => (
          <li key={line} className="text-foreground/75 text-xs leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

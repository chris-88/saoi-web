import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { MarketProductsCard as Payload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { providerInitials, splitValue } from './productRow'

type Row = Payload['rows'][number]

/**
 * The product card that follows the question asked (2026-11-12, build 3 of the first-home
 * experience, spec section 4; rows as key facts 2026-11-13).
 *
 * The server arranges the rows by what the question implies (their own account against the
 * market, by access, by the date that fits the keys, a mortgage by the sort they chose) and the
 * card names that arrangement first, in one short line. Then one row per product with its key
 * facts only (Chris, 2026-11-13: "we don't need to display everything in the line item"): the
 * provider's monogram, the lead, the kind as a chip, the figure in their money, and the headline
 * value with its period. Tapping a row opens what a person should know before choosing it, then
 * the rest; one row at a time. How it was worked out is folded behind one line; the statement
 * closes the card.
 *
 * Every word and figure is the server's; the card only lays them out and puts the customer's own
 * account first. Nothing here is a pick: the customer asks in the chat for more, or for another
 * arrangement, so the only controls on the card open and close detail.
 */
export function MarketProductsCard({ card }: { card: Payload }): ReactNode {
  // Stable sort: the server's order, with the customer's own account lifted to the top.
  const rows = [...card.rows].sort((a, b) => Number(b.held) - Number(a.held))
  const anyUnconfirmed = rows.some((row) => !row.confirmed)
  const [openId, setOpenId] = useState<string | null>(null)
  // When any row opens, every row keeps the chevron's room, so the values line up.
  const chevronRoom = rows.some(isExpandable)

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
        <ol className="divide-y border-t" aria-label={card.arrangement.title}>
          {rows.map((row) => (
            <ProductRow
              key={row.id}
              row={row}
              open={openId === row.id}
              chevronRoom={chevronRoom}
              onToggle={(next) => {
                setOpenId(next ? row.id : null)
              }}
            />
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

/**
 * What a row opens to: the facts to know first, then the rest. A card saved before 2026-11-13
 * has neither, so its `note` (which the closed row no longer shows) is the rest instead.
 */
function rowFacts(row: Row): { mustKnow: readonly string[]; detail: readonly string[] } {
  const mustKnow = (row.mustKnow ?? []).filter((line) => line !== '')
  const detail = row.detail === undefined ? (row.note === null ? [] : [row.note]) : row.detail
  return { mustKnow, detail: detail.filter((line) => line !== '') }
}

function isExpandable(row: Row): boolean {
  const { mustKnow, detail } = rowFacts(row)
  return mustKnow.length > 0 || detail.length > 0
}

function ProductRow({
  row,
  open,
  chevronRoom,
  onToggle,
}: {
  row: Row
  open: boolean
  chevronRoom: boolean
  onToggle: (open: boolean) => void
}): ReactNode {
  const panelId = useId()
  const { mustKnow, detail } = rowFacts(row)
  const expandable = isExpandable(row)
  const { value, period } = splitValue(row.value)

  const body = (
    <>
      <Monogram row={row} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start gap-1.5">
          <span className="line-clamp-2 min-w-0 text-sm leading-5 font-medium" title={row.lead}>
            {row.lead}
          </span>
          {!row.confirmed && (
            <span className="text-muted-foreground -ml-1 text-sm" aria-label="not confirmed">
              *
            </span>
          )}
          {row.held && (
            <Badge variant="secondary" className="mt-0.5 px-1.5 py-0 text-2xs font-normal">
              yours
            </Badge>
          )}
        </span>
        {/* Spaces between the parts (collapsed by the flex layout) keep the button's spoken
            name and the text apart: "bunq Easy Savings €581 by Jul 2028 instant access". The
            figure comes first, under the lead; the kind follows, and wraps under it if need be. */}{' '}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1">
          <span className="text-foreground/75 text-xs leading-snug">{row.figure}</span>{' '}
          <span className="bg-muted text-muted-foreground max-w-full truncate rounded-full px-1.5 text-2xs">
            {row.kind}
          </span>
        </span>
      </span>{' '}
      <span className="flex min-w-14 shrink-0 flex-col items-end">
        <span className="text-sm leading-5 font-semibold whitespace-nowrap tabular-nums">
          {value}
        </span>
        {period !== null && ' '}
        {period !== null && (
          <span className="text-muted-foreground text-2xs whitespace-nowrap">{period}</span>
        )}
      </span>
      {expandable ? (
        <ChevronDown
          aria-hidden
          className={cn(
            'text-muted-foreground mt-[3px] -ml-1 size-3.5 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      ) : (
        chevronRoom && <span aria-hidden className="-ml-1 size-3.5 shrink-0" />
      )}
    </>
  )

  const line = 'flex w-full items-start gap-2.5 px-4 py-2.5 text-left'
  if (!expandable) {
    return (
      <li>
        <div className={line}>{body}</div>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          onToggle(!open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            onToggle(false)
          }
        }}
        className={cn(
          line,
          'hover:bg-muted/50 focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
          open && 'bg-muted/50',
        )}
      >
        {body}
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={`About ${row.lead}`}
        hidden={!open}
        className="bg-muted/50 space-y-1.5 pr-4 pb-3 pl-13.5"
      >
        {mustKnow.length > 0 && (
          <ul className="text-foreground/75 list-disc space-y-0.5 pl-4 text-xs leading-snug">
            {mustKnow.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
        {detail.map((fact) => (
          <p key={fact} className="text-muted-foreground text-2xs leading-snug">
            {fact}
          </p>
        ))}
      </div>
    </li>
  )
}

/** The provider's initials in its own colours, or neutral when it has none on record. */
function Monogram({ row }: { row: Row }): ReactNode {
  const initials = providerInitials(row.lead, row.providerId)
  const brand = row.brand ?? null
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full leading-none font-semibold tracking-tight',
        // "B", "BoI", "MoCo": smaller as it lengthens, so four letters still sit inside.
        initials.length <= 2
          ? 'text-[11px]'
          : initials.length === 3
            ? 'text-[9.5px]'
            : 'text-[8px]',
        brand === null && 'bg-muted text-muted-foreground',
      )}
      style={brand === null ? undefined : { backgroundColor: brand.bg, color: brand.fg }}
    >
      {initials}
    </span>
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

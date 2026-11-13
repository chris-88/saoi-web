import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { MarketProductsCard as Payload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useProductSelection } from '@/saoirse/productSelection'
import { ChosenBadge } from './ChosenBadge'
import { BasisPart, Fold } from './Fold'
import { ProviderMonogram } from './ProviderMonogram'
import { groupRows, splitValue } from './productRow'

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
 * value with its period. How it was worked out is folded behind one line; the statement closes
 * the card.
 *
 * A row is selected to compare by a tap anywhere on it (Chris, 2026-11-13: "select products from
 * any of the cards that are presented, then compare the two that have been selected"), up to
 * three across every card, the circle at its edge showing the state. Rows no longer open: what a
 * person should know before choosing (`mustKnow`, `detail`) is in the comparison card instead,
 * and the data stays on the row for it and for Saoirse.
 *
 * When the server groups the rows by type ("Instant access", "Fixed term"; Chris, 2026-11-13:
 * different products were mixed in one list), each group sits under a small quiet label.
 *
 * A row the customer has chosen for their plan (the Choose sheet, from the compare bar) carries a
 * small badge naming the slot ("your monthly saving"), read from the live plan so a card shown
 * before the choice still shows it.
 *
 * Every word and figure is the server's; the card only lays them out and, in an ungrouped list,
 * puts the customer's own account first. Nothing here is a pick: selecting is the customer's
 * own choice of what to compare, and the comparison never orders or favours.
 */
export function MarketProductsCard({
  card,
  cardId,
  caseId = null,
}: {
  card: Payload
  /** The chat entry this card is, so a refused fourth selection is noted on this card. */
  cardId?: string | undefined
  /** The conversation, whose plan says which rows are chosen; with none, no badges. */
  caseId?: string | null
}): ReactNode {
  const fallbackId = useId()
  const cardMessageId = cardId ?? fallbackId
  const selected = useProductSelection((state) => state.selected)
  const refusedHere = useProductSelection((state) => state.refusedOn === cardMessageId)
  const toggle = useProductSelection((state) => state.toggle)
  const selectedIds = new Set(selected.map((item) => item.rowId))

  // Stable sort: the server's order, with the customer's own account lifted to the top.
  const rows = [...card.rows].sort((a, b) => Number(b.held) - Number(a.held))
  // Grouped, the server's groups decide the order, a "Yours" group included.
  const sections = groupRows(
    card.arrangement.groups === undefined ? rows : card.rows,
    card.arrangement.groups,
  )
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
        sections.map((section, index) => (
          <RowSection
            // Labels are the server's and distinct; the unlabelled rest comes last.
            key={section.label ?? `rest-${String(index)}`}
            label={section.label}
            listLabel={sections.length === 1 ? card.arrangement.title : undefined}
          >
            {section.rows.map((row) => (
              <ProductRow
                key={row.id}
                row={row}
                selected={selectedIds.has(row.id)}
                caseId={caseId}
                onToggle={() => {
                  toggle({ rowId: row.id, lead: row.lead, cardMessageId })
                }}
              />
            ))}
          </RowSection>
        ))
      )}

      {/* Always mounted, so the refusal is announced when it appears. */}
      <p
        role="status"
        className={cn('text-muted-foreground px-4 text-xs', refusedHere && 'border-t py-2')}
      >
        {refusedHere ? 'Up to three to compare. Untick one to add another.' : ''}
      </p>

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
 * One list of rows: under a small quiet label when the server grouped them, else unlabelled (the
 * whole card's list, named by the arrangement, or the rows no group named).
 */
function RowSection({
  label,
  listLabel,
  children,
}: {
  label: string | null
  listLabel: string | undefined
  children: ReactNode
}): ReactNode {
  const labelId = useId()
  if (label === null) {
    return (
      <ol className="divide-y border-t" aria-label={listLabel}>
        {children}
      </ol>
    )
  }
  return (
    <div className="border-t">
      <p
        id={labelId}
        className="text-muted-foreground px-4 pt-2.5 text-2xs font-medium tracking-wider uppercase"
      >
        {label}
      </p>
      <ol className="divide-y" aria-labelledby={labelId}>
        {children}
      </ol>
    </div>
  )
}

function ProductRow({
  row,
  selected,
  caseId,
  onToggle,
}: {
  row: Row
  selected: boolean
  /** The conversation, whose plan says whether this row is chosen. */
  caseId: string | null
  onToggle: () => void
}): ReactNode {
  const { value, period } = splitValue(row.value)

  return (
    <li>
      {/*
        The whole row is the control: a tap anywhere selects it to compare, or takes it out. A
        native button, so Tab reaches it and Enter and Space press it; the circle at its edge is
        the state. Its spoken name is the row's own text.
      */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={onToggle}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 flex min-h-11 w-full items-start gap-2.5 py-2.5 pr-3 pl-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
      >
        <ProviderMonogram lead={row.lead} providerId={row.providerId} brand={row.brand} />
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
          {/* Spaces between the parts (collapsed by the flex layout) keep the spoken name and
              the text apart: "bunq Easy Savings €581 by Jul 2028 instant access". The figure
              comes first, under the lead; the kind follows, and wraps under it if need be. */}{' '}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="text-foreground/75 text-xs leading-snug">{row.figure}</span>{' '}
            <span className="bg-muted text-muted-foreground max-w-full truncate rounded-full px-1.5 text-2xs">
              {row.kind}
            </span>
            {caseId !== null && <ChosenBadge caseId={caseId} rowId={row.id} />}
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
        <SelectMark selected={selected} />
      </button>
    </li>
  )
}

/** The 20px circle at the row's edge: empty, or a tick in the primary colour. */
function SelectMark({ selected }: { selected: boolean }): ReactNode {
  return (
    <span
      aria-hidden
      data-slot="select-mark"
      className={cn(
        'grid size-5 shrink-0 place-items-center self-center rounded-full border-[1.5px] transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/40 bg-card',
      )}
    >
      {selected && <Check className="size-3" strokeWidth={3} />}
    </span>
  )
}

/** The basis statement (duty-of-care standard 2.4), folded: detail only when asked. */
function Basis({ basis }: { basis: Payload['basis'] }): ReactNode {
  return (
    <Fold label="How this was worked out">
      <BasisPart label="Figures used" lines={basis.figures} />
      <BasisPart label="Arranged by" lines={[basis.objective]} />
      <BasisPart label="Assumed" lines={basis.assumptions} />
      <BasisPart label="Covered" lines={[basis.coverage]} />
      <BasisPart label="Warnings" lines={basis.warnings} />
    </Fold>
  )
}

import type { ReactNode } from 'react'
import type { ProductComparisonCard as Payload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BasisPart, Fold } from './Fold'
import { ProviderMonogram } from './ProviderMonogram'

/**
 * The products the customer selected, side by side (`compare_products`; Chris, 2026-11-13:
 * "compare the two that have been selected against each other and help the customer come to a
 * choice").
 *
 * The columns are in the customer's own selection order and stay there: nothing is ordered,
 * highlighted or marked in a way that implies a pick. The rows are a compact table; a row whose
 * values differ is set in normal text and the rest quietly, so the eye lands on what tells them
 * apart. Then what differs in a few lines, and the one question that decides between them, as
 * Saoirse asks it. What to know about each (the products card's must-knows and detail) and how
 * it was worked out are folded; the statement closes the card.
 *
 * At 390px two columns fit the card; three scroll sideways inside the table only, never the page.
 */
export function ProductComparisonCard({ card }: { card: Payload }): ReactNode {
  const three = card.columns.length > 2
  const knowing = card.columns
    .map((column) => {
      const entry = card.mustKnow.find((item) => item.rowId === column.rowId)
      const facts = (entry?.facts ?? []).filter((line) => line !== '')
      const detail = (entry?.detail ?? []).filter((line) => line !== '')
      return { column, facts, detail }
    })
    .filter(({ facts, detail }) => facts.length > 0 || detail.length > 0)
  const differences = card.differences.filter((line) => line !== '')

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <h3 className="px-4 pt-3.5 pb-2 text-sm font-semibold text-balance">{card.title}</h3>

      {/*
        The only thing that scrolls sideways. Focusable when it can scroll (three columns), so a
        keyboard can move it too.
      */}
      <div
        className="overflow-x-auto overscroll-x-contain"
        {...(three ? { tabIndex: 0, role: 'region', 'aria-label': `${card.title}, table` } : {})}
      >
        <table className={cn('w-full table-fixed border-collapse text-xs', three && 'min-w-104')}>
          <colgroup>
            <col className={three ? 'w-22' : 'w-[28%]'} />
            {card.columns.map((column) => (
              <col key={column.rowId} />
            ))}
          </colgroup>
          <thead>
            <tr className="align-top">
              <td className={cn('pl-4', three && 'bg-card sticky left-0 z-10')} />
              {card.columns.map((column) => (
                <th key={column.rowId} scope="col" className="px-2 pb-2.5 text-left font-normal">
                  <span className="flex flex-col items-start gap-1.5">
                    <ProviderMonogram
                      lead={column.lead}
                      providerId={column.providerId}
                      brand={column.brand}
                    />
                    <span
                      className="line-clamp-2 text-xs leading-4 font-medium break-words"
                      title={column.lead}
                    >
                      {column.lead}
                    </span>{' '}
                    <span className="bg-muted text-muted-foreground max-w-full truncate rounded-full px-1.5 text-2xs">
                      {column.kind}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="border-t">
            {card.rows.map((row) => (
              <tr key={row.label} className="border-b align-top last:border-b-0">
                <th
                  scope="row"
                  className={cn(
                    'text-muted-foreground py-2 pr-2 pl-4 text-left text-2xs leading-snug font-normal',
                    // Scrolling three across, the labels stay put beside the values.
                    three && 'bg-card sticky left-0 z-10',
                  )}
                >
                  {row.label}
                </th>
                {card.columns.map((column, index) => (
                  <td
                    key={column.rowId}
                    className={cn(
                      'px-2 py-2 leading-snug break-words tabular-nums',
                      row.differs ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {row.values[index] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {differences.length > 0 && (
        <div className="border-t px-4 py-3">
          <h4 className="text-muted-foreground text-2xs font-medium tracking-wider uppercase">
            What differs
          </h4>
          <ul className="text-foreground/85 mt-1 list-disc space-y-0.5 pl-4 text-xs leading-snug">
            {differences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {card.decides !== '' && (
        <p className="border-t px-4 py-3 text-sm leading-snug font-medium text-balance">
          {card.decides}
        </p>
      )}

      {knowing.length > 0 && (
        <Fold label="What to know about each">
          {knowing.map(({ column, facts, detail }) => (
            <div key={column.rowId} className="space-y-1">
              <p className="text-xs font-medium">{column.lead}</p>
              {facts.length > 0 && (
                <ul className="text-foreground/75 list-disc space-y-0.5 pl-4 text-xs leading-snug">
                  {facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              )}
              {detail.map((line) => (
                <p key={line} className="text-muted-foreground text-2xs leading-snug">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </Fold>
      )}

      <Fold label="How this was worked out">
        <BasisPart label="Figures used" lines={card.basis.figures} />
        <BasisPart label="Assumed" lines={card.basis.assumptions} />
        <BasisPart label="Covered" lines={[card.basis.coverage]} />
        <BasisPart label="Warnings" lines={card.basis.warnings} />
      </Fold>

      <p className="text-muted-foreground border-t px-4 py-2 text-[11px] leading-snug">
        {card.statement}
      </p>
    </Card>
  )
}

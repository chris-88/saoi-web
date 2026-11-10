import type { ReactNode } from 'react'
import { ExternalLinkIcon, MapIcon } from 'lucide-react'
import type { Card as CardPayload } from '@contracts/cards.ts'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/IconTile'
import { Reveal } from '@/components/Primitives'
import { STAGGER } from '@/lib/motion'

/** "Check: …" before a check, unless it already starts by saying so ("Check eligibility with…"). */
export function checkLine(check: string): string {
  return /^check\b/i.test(check.trim()) ? check : `Check: ${check}`
}

type Payload = Extract<CardPayload, { type: 'saved_plan' }>

const label =
  'text-muted-foreground text-[10.5px] font-semibold tracking-[0.08em] uppercase leading-none'

/**
 * A plan the customer made in their own AI and opened here.
 *
 * The first thing on screen after the claim link, before Saoirse says a word. Every line is the
 * server's, built from the stored plan: the goals, each product with what goes into it and what
 * it is projected to make, where those figures came from and when they were checked, and what
 * the data does not say. Read on a phone days later, without the conversation that produced
 * it, so the provenance and the unknowns are on the card rather than behind a tap.
 *
 * Something to read, not something to decide. Saoi opens nothing; the provider links go to the
 * providers.
 */
export function SavedPlanCard({ card }: { card: Payload }): ReactNode {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <IconTile tone="deep">
          <MapIcon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className={label}>Your saved comparison</p>
          <h3 className="mt-1 text-base font-semibold text-balance">{card.title}</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed text-pretty">
            {card.summary}
          </p>
        </div>
      </div>

      {card.goals.length > 0 && (
        <div className="border-t px-4 py-3">
          <p className={label}>Goals</p>
          <ul className="mt-2 space-y-1">
            {card.goals.map((goal) => (
              <li key={goal.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{goal.label}</span>
                {goal.target !== null && (
                  <span className="text-muted-foreground text-xs tabular-nums">{goal.target}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.comparison !== undefined && (
        <div className="border-t px-4 py-3">
          <p className={label}>Your home options</p>
          <p className="text-muted-foreground mt-1 text-xs">{card.comparison.sortedBy}</p>
          {card.comparison.filters.map((filter) => (
            <p key={filter} className="text-muted-foreground text-xs">
              {filter}
            </p>
          ))}
          <ol className="divide-y" aria-label="The first options, in the order chosen">
            {card.comparison.options.map((option, index) => (
              <li key={index} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {option.lender}
                    {!option.confirmed && (
                      <span className="text-muted-foreground ml-2 rounded-md border px-1.5 text-[11px] font-normal">
                        Unconfirmed
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {option.kind} · {option.rate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{option.fiveYear}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">{option.monthly}</p>
                </div>
              </li>
            ))}
          </ol>
          {card.comparison.total > card.comparison.options.length && (
            <p className="text-muted-foreground text-xs">
              {card.comparison.total - card.comparison.options.length} more options in the
              comparison.
            </p>
          )}
        </div>
      )}

      {card.products.length > 0 && (
        <ol className="divide-y border-t" aria-label="Products in the plan">
          {card.products.map((product, index) => (
            <Reveal
              key={`${product.providerName}-${product.name}-${String(index)}`}
              mode="mount"
              delay={index * STAGGER}
            >
              <li className="px-4 py-3">
                <p className={label}>
                  {String(index + 1)}. {product.role}
                </p>
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-pretty">{product.name}</p>
                    <p className="text-muted-foreground text-xs">{product.providerName}</p>
                  </div>
                  {product.rate !== null && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {product.rate}
                    </span>
                  )}
                </div>
                {product.amounts.length > 0 && (
                  <p className="mt-1.5 text-sm tabular-nums">{product.amounts.join(' · ')}</p>
                )}
                {product.projected !== null && (
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed tabular-nums">
                    {product.projected}
                  </p>
                )}
                {product.checks.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {product.checks.map((check) => (
                      <li key={check} className="text-xs leading-relaxed">
                        {checkLine(check)}
                      </li>
                    ))}
                  </ul>
                )}
                {product.unknowns.length > 0 && (
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Not published: {product.unknowns.join(', ')}
                  </p>
                )}
                <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span>{product.provenance}</span>
                  {product.url !== null && (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      {product.providerName}’s page
                      <ExternalLinkIcon className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      )}

      {card.debts.length > 0 && (
        <div className="border-t px-4 py-3">
          <p className={label}>Debts, in order</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {card.debts.map((line) => (
              <li key={line} className="text-sm leading-relaxed">
                {line}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-muted/40 space-y-1.5 border-t px-4 py-3 text-xs leading-relaxed">
        <p>{card.basis}</p>
        {card.assumptions.length > 0 && (
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
            {card.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground">
          Information, not advice. Made with your AI assistant on {day(card.createdAt)}; rates
          checked {day(card.dataCheckedAt)}. Saoi opens nothing: you apply with each provider.
        </p>
        <p className="text-muted-foreground">
          Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares
          products on the figures you give.
        </p>
        {card.attributions.map((line) => (
          <p key={line} className="text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </Card>
  )
}

function day(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  })
}

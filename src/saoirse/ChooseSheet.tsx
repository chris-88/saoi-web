import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCasePlan, useChoosePlanProduct } from '@/api/plan'
import type { CasePlan } from '@contracts/case-plan.ts'
import { PLAN_CHOICE_SLOTS, type PlanChoiceSlot } from '@contracts/market-plan.ts'
import { slotName } from '@/lib/planChoices'
import { useProductSelection } from '@/saoirse/productSelection'

/** The product being chosen: a products row, or a comparison column, by its row id. */
export type ChoosableProduct = { readonly rowId: string; readonly lead: string }

/**
 * "Choose for…": the customer putting one product into their plan (Chris, 2026-11-13: "get the
 * customer to pick products from the product lists we're presenting").
 *
 * A bottom sheet with the plan's three slots, worded in their own figures where the plan has
 * them ("My €32,000", "My €1,000 a month", "My mortgage"). A slot already holding another
 * product names it, and the tap asks once, in place, before replacing it. The tap is the
 * commit (the model proposes, the UI commits): it calls `POST …/plan/choices`; on success the
 * selection clears, the case is read again (the badges appear), and the chat says nothing, as
 * the server narrates the choice on the next turn. A refusal shows the server's sentence here.
 */
export function ChooseSheet({
  caseId,
  product,
  trigger,
}: {
  caseId: string
  product: ChoosableProduct
  /** The button that opens it; focus returns to it when the sheet closes. */
  trigger: ReactNode
}): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md gap-2 rounded-t-xl pb-[max(1rem,var(--safe-bottom))]"
      >
        <SheetHeader className="pr-10 pb-0">
          <SheetTitle>Choose for your plan</SheetTitle>
          <SheetDescription className="line-clamp-2">{product.lead}</SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so the plan is read when the sheet is, not before. */}
        {open && (
          <ChooseBody
            caseId={caseId}
            product={product}
            onChosen={() => {
              setOpen(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ChooseBody({
  caseId,
  product,
  onChosen,
}: {
  caseId: string
  product: ChoosableProduct
  onChosen: () => void
}): ReactNode {
  const plan = useCasePlan(caseId)
  const choose = useChoosePlanProduct(caseId)
  const clearSelection = useProductSelection((state) => state.clear)
  /** The slot whose replacement is being confirmed, if any. */
  const [confirming, setConfirming] = useState<PlanChoiceSlot | null>(null)
  const [pressed, setPressed] = useState<PlanChoiceSlot | null>(null)

  const commit = (slot: PlanChoiceSlot): void => {
    setPressed(slot)
    choose.mutate(
      { slot, rowId: product.rowId },
      {
        onSuccess: () => {
          clearSelection()
          onChosen()
        },
      },
    )
  }

  if (plan.isPending) {
    return (
      <p role="status" className="text-muted-foreground px-4 py-3 text-sm">
        Looking up your plan…
      </p>
    )
  }

  // Without the plan (none yet, or it would not load) the slots are in plain words; the choice
  // can still be made, and the server says so if it cannot take it.
  const read: CasePlan | null = plan.isError ? null : plan.data

  return (
    <div className="space-y-2 px-4 pb-2">
      {plan.isError && (
        <p role="alert" className="text-destructive text-xs">
          Your plan would not load. {plan.error.message}
        </p>
      )}
      <ul className="bg-card divide-y overflow-hidden rounded-xl border" aria-label="Choose for">
        {PLAN_CHOICE_SLOTS.map((slot) => {
          const current = read?.choices[slot] ?? null
          const same = current?.rowId === product.rowId
          return (
            <li key={slot}>
              <button
                type="button"
                disabled={same || choose.isPending}
                aria-expanded={current !== null && !same ? confirming === slot : undefined}
                onClick={() => {
                  choose.reset()
                  if (current !== null && !same) {
                    setConfirming(confirming === slot ? null : slot)
                    return
                  }
                  commit(slot)
                }}
                className="hover:bg-accent/60 focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-default"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium tabular-nums">
                    {slotName(slot, read, 'My')}
                  </span>
                  {current !== null && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {same ? 'Chosen already' : `Now: ${current.lead}`}
                    </span>
                  )}
                </span>
                {same ? (
                  <Check className="text-primary size-4 shrink-0" aria-hidden />
                ) : choose.isPending && pressed === slot ? (
                  <span className="text-muted-foreground shrink-0 text-xs">Choosing…</span>
                ) : null}
              </button>
              {confirming === slot && current !== null && !same && (
                <ReplaceConfirm
                  from={current.lead}
                  to={product.lead}
                  pending={choose.isPending}
                  onReplace={() => commit(slot)}
                  onKeep={() => setConfirming(null)}
                />
              )}
            </li>
          )
        })}
      </ul>
      {choose.isError && (
        <p role="alert" className="text-destructive text-xs">
          That was not chosen. {choose.error.message}
        </p>
      )}
    </div>
  )
}

/** The one question before a slot's choice is replaced, asked in place under the slot. */
function ReplaceConfirm({
  from,
  to,
  pending,
  onReplace,
  onKeep,
}: {
  from: string
  to: string
  pending: boolean
  onReplace: () => void
  onKeep: () => void
}): ReactNode {
  const replace = useRef<HTMLButtonElement>(null)
  useEffect(() => replace.current?.focus(), [])
  return (
    <div className="bg-muted/40 space-y-2 px-3 py-2.5" role="group" aria-label="Replace the choice">
      <p className="text-xs leading-snug">
        Replace <span className="font-medium">{from}</span> with{' '}
        <span className="font-medium">{to}</span>?
      </p>
      <div className="flex gap-2">
        <Button
          ref={replace}
          type="button"
          size="sm"
          className="h-9"
          disabled={pending}
          onClick={onReplace}
        >
          {pending ? 'Replacing…' : 'Replace'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onKeep}>
          Keep it
        </Button>
      </div>
    </div>
  )
}

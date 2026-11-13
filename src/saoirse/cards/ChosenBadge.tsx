import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { usePlanForCards } from '@/api/plan'
import { chosenSlotOf, slotBadge } from '@/lib/planChoices'
import { cn } from '@/lib/utils'

/**
 * What a chosen row or column says it is chosen for, in short words ("your €32,000", "your
 * monthly saving", "your mortgage"), or nothing. The customer's own choice, read from the live
 * plan, so it reads as theirs and never as Saoi's pick. Mounted only where there is a case, so
 * a card shown without one reads nothing.
 */
export function ChosenBadge({
  caseId,
  rowId,
  className,
}: {
  caseId: string
  rowId: string
  className?: string | undefined
}): ReactNode {
  const plan = usePlanForCards(caseId)
  const slot = chosenSlotOf(rowId, plan?.choices)
  if (slot === null) return null
  return (
    <>
      {/* A space, so the spoken name and the text keep the badge apart from what precedes it. */}{' '}
      <Badge
        data-slot="chosen-badge"
        className={cn(
          'bg-primary/12 text-primary dark:bg-primary/20 shrink-0 px-1.5 py-0 text-2xs font-medium',
          className,
        )}
      >
        <span className="sr-only">Chosen for</span> {slotBadge(slot, plan)}
      </Badge>
    </>
  )
}

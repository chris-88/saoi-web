import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProductSelection } from '@/saoirse/productSelection'

/** The customer's message when they press Compare; the selection goes with it. */
export const COMPARE_MESSAGE = 'Compare these'

/**
 * The slim bar above the composer while products are selected: what is selected, Compare (from
 * two) and Clear. Nothing when nothing is selected.
 *
 * Compare sends "Compare these" as the customer's own message with the selection on the turn;
 * the selection clears when the reply arrives (`useConversation`). A message they type instead
 * carries the selection the same way.
 */
export function CompareBar({
  onCompare,
  canSend,
  className,
}: {
  onCompare: () => void
  /** Whether a message can go now (not while a turn is in flight). Clear is always open. */
  canSend: boolean
  className?: string | undefined
}): ReactNode {
  const selected = useProductSelection((state) => state.selected)
  const clear = useProductSelection((state) => state.clear)
  if (selected.length === 0) return null

  const leads = selected.map((item) => item.lead)
  const summary = selected.length === 1 ? '1 selected' : leads.join(' · ')

  return (
    <div
      role="group"
      aria-label="Selected to compare"
      className={cn('flex items-center gap-2', className)}
    >
      <p className="text-foreground/80 min-w-0 flex-1 truncate text-xs" title={leads.join(' · ')}>
        {selected.length > 1 && <span className="sr-only">{selected.length} selected: </span>}
        {summary}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-8 px-2.5 text-xs"
        onClick={clear}
      >
        Clear
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 rounded-full px-3.5 text-xs"
        disabled={selected.length < 2 || !canSend}
        onClick={onCompare}
      >
        Compare
      </Button>
    </div>
  )
}

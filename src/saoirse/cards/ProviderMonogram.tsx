import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { providerInitials } from './productRow'

/**
 * The provider's initials in its own colours, or neutral when it has none on record. Shared by
 * the products card's rows and the comparison card's columns.
 */
export function ProviderMonogram({
  lead,
  providerId,
  brand,
}: {
  lead: string
  providerId: string | undefined
  brand: { bg: string; fg: string } | null | undefined
}): ReactNode {
  const initials = providerInitials(lead, providerId)
  const colours = brand ?? null
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
        colours === null && 'bg-muted text-muted-foreground',
      )}
      style={colours === null ? undefined : { backgroundColor: colours.bg, color: colours.fg }}
    >
      {initials}
    </span>
  )
}

import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { IconTile } from '@/components/IconTile'
import { cn } from '@/lib/utils'

/**
 * The rows the pages under You are made of: a label over a group, the group as one card, and a
 * row that goes somewhere or does something.
 */

/** The uppercase label over a group of rows, the same voice as a section label in the chat. */
export function GroupLabel({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <h2 className="text-muted-foreground mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
      {children}
    </h2>
  )
}

/** Rows sit on one card, divided, so a group reads as one thing. */
export function Group({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string | undefined
}): ReactNode {
  return (
    <div className={cn('bg-card divide-y overflow-hidden rounded-xl border shadow-xs', className)}>
      {children}
    </div>
  )
}

type RowProps = {
  readonly icon: ReactNode
  readonly label: string
  /** One line under the label: what is there, or what the page is for. */
  readonly detail?: string | undefined
  /** A figure or a count on the right, when one is worth the space. */
  readonly value?: string | undefined
}

export const rowClass =
  'hover:bg-accent/60 focus-visible:ring-ring flex w-full items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-default disabled:opacity-60'

function RowBody({ icon, label, detail, value }: RowProps): ReactNode {
  return (
    <>
      <IconTile tone="neutral" size="sm">
        {icon}
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {detail !== undefined && (
          <span className="text-muted-foreground block truncate text-xs">{detail}</span>
        )}
      </span>
      {value !== undefined && (
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">{value}</span>
      )}
      <ChevronRight className="text-muted-foreground/60 size-4 shrink-0" aria-hidden />
    </>
  )
}

/** A row that goes somewhere. */
export function LinkRow({ to, ...row }: RowProps & { readonly to: string }): ReactNode {
  return (
    <Link to={to} className={rowClass}>
      <RowBody {...row} />
    </Link>
  )
}

/**
 * A row that does something. Spreads what it is given so a Radix trigger can make it the
 * thing that opens a sheet.
 */
export function ButtonRow({
  icon,
  label,
  detail,
  value,
  className,
  ...props
}: RowProps & ComponentProps<'button'>): ReactNode {
  return (
    <button type="button" className={cn(rowClass, className)} {...props}>
      <RowBody icon={icon} label={label} detail={detail} value={value} />
    </button>
  )
}

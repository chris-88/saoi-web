import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A line that opens to detail and closes again (progressive disclosure: detail only when
 * asked). The products card's "How this was worked out" and the comparison card's folds.
 */
export function Fold({ label, children }: { label: string; children: ReactNode }): ReactNode {
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
        {label}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={label}
        hidden={!open}
        className="space-y-2 px-4 pb-3"
      >
        {children}
      </div>
    </div>
  )
}

/** One labelled part of a basis statement; nothing when it has no lines. */
export function BasisPart({
  label,
  lines,
}: {
  label: string
  lines: readonly string[]
}): ReactNode {
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

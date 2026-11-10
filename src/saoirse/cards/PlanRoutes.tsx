import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { PlanRoute } from '@/lib/planRoutes'
import { cn } from '@/lib/utils'

const FIRST = 3

/**
 * The routes to a home, under the saved comparison (2026-11-10).
 *
 * The first three lines as they came, then "More routes (N)" for the rest. Each row opens to
 * its reason or the one question that would settle it, its conditions and the first source.
 * The order is the server's; nothing is marked best and nothing is an instruction.
 */
export function PlanRoutes({ routes }: { routes: readonly PlanRoute[] }): ReactNode {
  const [all, setAll] = useState(false)
  const listId = useId()
  if (routes.length === 0) return null
  const shown = all ? routes : routes.slice(0, FIRST)
  const rest = routes.length - FIRST

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <h3 className="px-4 pt-3 pb-2 text-sm font-semibold">Routes to a home</h3>
      <ul id={listId} className="divide-y border-t px-4" aria-label="Routes to a home">
        {shown.map((route) => (
          <RouteRow key={route.id} route={route} />
        ))}
      </ul>
      {rest > 0 && !all && (
        <div className="border-t px-4">
          <button
            type="button"
            aria-controls={listId}
            className="text-primary inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
            onClick={() => {
              setAll(true)
            }}
          >
            More routes ({String(rest)})
          </button>
        </div>
      )}
    </Card>
  )
}

function RouteRow({ route }: { route: PlanRoute }): ReactNode {
  const [open, setOpen] = useState(false)
  const detailId = useId()
  const why = route.status === 'needs_one_detail' ? (route.missing ?? route.reason) : route.reason
  const source = route.sources[0]

  return (
    <li className="py-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        className="flex min-h-11 w-full items-start justify-between gap-3 py-1.5 text-left text-sm"
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <span className="min-w-0">{route.line}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        id={detailId}
        hidden={!open}
        className="text-muted-foreground space-y-1.5 pb-2 text-xs leading-snug"
      >
        {why !== null && <p>{why}</p>}
        {route.conditions.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4">
            {route.conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        )}
        {source !== undefined && (
          <p>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {route.name}: the official page
            </a>
            , read {source.checkedOn}
          </p>
        )}
      </div>
    </li>
  )
}

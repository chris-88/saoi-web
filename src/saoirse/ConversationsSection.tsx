import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startNewCase, switchCase } from '@/lib/session'
import { landOnChat } from '@/lib/landOnChat'
import { useCases } from '@/api/cases'
import { when } from '@/lib/when'
import { cn } from '@/lib/utils'

/** The one line that says what the row is. */
function summaryOf(item: {
  readonly messages: number
  readonly applications: number
  readonly lastActivityAt: string | null
}): string {
  return [
    item.messages === 0
      ? 'empty'
      : `${String(item.messages)} message${item.messages === 1 ? '' : 's'}`,
    item.applications > 0
      ? `${String(item.applications)} application${item.applications === 1 ? '' : 's'}`
      : null,
    item.lastActivityAt === null ? null : when(item.lastActivityAt),
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

/**
 * The "Conversations" page under You: everything this browser has started with Saoirse, a way
 * to jump between them, and a way to start another.
 *
 * Built for running a demonstration from the screen the audience is looking at. Between takes
 * you need a clean conversation, and part-way through one you need to jump back to a prepared
 * case — doing either from a console on a second tab means the filmed screen shows somebody
 * alt-tabbing.
 *
 * A visitor sees their own conversations and nothing else. The wider list belongs to whoever
 * holds the presenter key, because these conversations contain what real people typed, which
 * is the same reason the data notice exists at all.
 */
export function ConversationsSection(): ReactNode {
  const cases = useCases()
  const goTo = useMutation({ mutationFn: (id: string) => switchCase(id), onSuccess: landOnChat })
  const begin = useMutation({ mutationFn: () => startNewCase('new'), onSuccess: landOnChat })
  const busy = goTo.isPending || begin.isPending

  return (
    <div className="space-y-4">
      {cases.isPending ? (
        <p className="text-muted-foreground text-sm">Looking them up…</p>
      ) : cases.isError ? (
        <div className="space-y-2">
          <p className="text-destructive text-sm">
            Your conversations would not load. {cases.error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => void cases.refetch()}>
            Try again
          </Button>
        </div>
      ) : cases.data.cases.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Nothing started yet. Say something to Saoirse and it will be here.
        </p>
      ) : (
        <ul
          className="bg-card divide-y rounded-lg border shadow-xs"
          aria-label="Your conversations"
        >
          {cases.data.cases.map((item) => (
            <li key={item.caseId}>
              <button
                type="button"
                disabled={busy || item.current}
                aria-current={item.current ? 'true' : undefined}
                onClick={() => goTo.mutate(item.caseId)}
                className={cn(
                  'hover:bg-accent/60 focus-visible:ring-ring flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default',
                  item.current && 'bg-accent/40',
                )}
              >
                {item.current ? (
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                ) : (
                  <span className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.label ?? item.opening ?? 'Nothing said yet'}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {summaryOf(item)}
                    {cases.data.presenter && !item.mine && ' · not yours'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {goTo.isError && (
        <p className="text-destructive text-xs">
          That conversation would not open. {goTo.error.message}
        </p>
      )}

      <Button className="w-full" disabled={busy} onClick={() => begin.mutate()}>
        <Plus className="size-4" />
        Start a new conversation
      </Button>
      {begin.isError && <p className="text-destructive text-xs">{begin.error.message}</p>}
    </div>
  )
}

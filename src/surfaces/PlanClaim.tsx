import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTile } from '@/components/IconTile'
import { SaoiWordmark } from '@/saoirse/SaoiWordmark'
import { CLAIM_COPY, problemOf, type ClaimProblem } from '@/lib/planClaim'
import { queryKeys } from '@/lib/queryKeys'
import { claimPlan } from '@/lib/session'
import { isBackendConfigured } from '@/lib/env'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { routes } from '@/app/routes'

/**
 * `#/plan/:token`: a plan the customer made in their own AI, opened in the app.
 *
 * The link comes from the AI conversation (`saoi_save_plan`). Claiming it puts the plan in this
 * browser's conversation, the one the chat opens next, and the chat's own return turn shows
 * the plan card and Saoirse's opening on it. So this page only claims and hands over: it holds
 * no plan and renders none. Works the same in a tab and in the installed app; the token is
 * opaque and spent by the claim (Invariant 8), and the address is replaced on the way to the
 * chat so it is not left in the history.
 *
 * The claim is a query keyed by the token, run once and never refetched by itself: the server
 * answers the same browser's second claim with the same conversation, but nothing here should
 * lean on that. "Try again" is offered only where the link is still unspent.
 */
export function PlanClaim(): ReactNode {
  useDocumentTitle('Your plan')
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const claim = useQuery({
    queryKey: queryKeys.plans.claim(token),
    queryFn: () => claimPlan(token),
    enabled: isBackendConfigured && token !== '',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (claim.isSuccess) void navigate(routes.saoirse, { replace: true })
  }, [claim.isSuccess, navigate])

  const problem: ClaimProblem | null = !isBackendConfigured
    ? 'failed'
    : token === ''
      ? 'unknown'
      : claim.isError
        ? problemOf(claim.error)
        : null
  const retryable = problem === 'busy' || problem === 'failed'

  return (
    <div className="bg-background min-h-dvh">
      <header className="bg-card/95 border-b">
        <div className="mx-auto flex w-full max-w-md items-center px-4 py-2.5">
          <SaoiWordmark className="h-5" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-5 px-4 py-8">
        <IconTile tone="deep" size="lg">
          <MapIcon />
        </IconTile>

        {problem === null ? (
          <section className="space-y-3" aria-live="polite" aria-busy="true">
            <h1 className="text-h3 font-semibold">Opening your plan…</h1>
            <p className="text-muted-foreground text-sm">
              Bringing over the plan you made with your AI assistant.
            </p>
            <Skeleton className="h-28 w-full" />
          </section>
        ) : (
          <section className="space-y-4">
            <h1 className="text-h3 font-semibold">{CLAIM_COPY[problem].title}</h1>
            <Alert variant={problem === 'busy' ? 'default' : 'destructive'}>
              <AlertDescription>{CLAIM_COPY[problem].body}</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              {retryable && (
                <Button disabled={claim.isFetching} onClick={() => void claim.refetch()}>
                  Try again
                </Button>
              )}
              <Button asChild variant={retryable ? 'outline' : 'default'}>
                <Link to={routes.saoirse} replace>
                  Start a fresh conversation with Saoirse
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

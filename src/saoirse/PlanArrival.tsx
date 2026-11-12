import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { PreviewPlanResponse } from '@contracts/session.ts'
import { ChatBubble } from '@/saoirse/ChatBubble'
import { Composer } from '@/saoirse/Composer'
import { SuggestionList, type Suggestion } from '@/saoirse/SuggestionList'
import { TypingBubble } from '@/saoirse/TypingBubble'
import { PlanArrivalCard } from '@/saoirse/cards/PlanArrivalCard'
import { CompactPlanCard, type CompactPlan } from '@/saoirse/cards/SavedPlanCard'
import { PROBLEM_LINES, problemOf, type ClaimProblem } from '@/lib/planClaim'
import { handFirstMessage } from '@/lib/planArrival'
import { routesOf } from '@/lib/planRoutes'
import { claimPlan, previewPlan } from '@/lib/session'
import { isBackendConfigured } from '@/lib/env'
import { queryKeys } from '@/lib/queryKeys'
import { routes } from '@/app/routes'
import { reloadIntoNewerBuild, reloadPage } from '@/app/staleDeploy'

/** A preview that never arrives: the page is reloading, and the typing bubble holds until then. */
const reloading = (): Promise<never> => new Promise<never>(() => undefined)

/**
 * A saved comparison arriving in the app (2026-11-12, build 1 of the first-home experience).
 *
 * The app's own card, built from the public preview and showing what the host's card showed;
 * under it one small grey box linking to the data protection notice; then Saoirse's one line,
 * the question whose answer would change the plan most. Nothing else competes with it: no
 * welcome, no chips, no second question. Nothing is stored before the customer writes: their
 * first message claims the plan (the token is spent only then, Invariant 8), and the chat then
 * opens on the server's conversation (the card and the question, their message, the reply).
 * A link that cannot be opened is a message too, with a chip to start again.
 */
export function PlanArrival({
  token,
  className,
}: {
  token: string
  className?: string | undefined
}): ReactNode {
  const navigate = useNavigate()
  /** What they wrote, shown as theirs while the claim runs and kept for a retry. */
  const [sent, setSent] = useState<string | null>(null)

  const preview = useQuery({
    queryKey: queryKeys.plans.preview(token),
    /*
     * A preview this build cannot read is an old page after a release (the service worker served
     * yesterday's bundle). When a newer build is there, reload into it and stay on the typing
     * bubble while the page goes; otherwise the error stands and the arrival says to reload.
     */
    queryFn: () =>
      previewPlan(token).catch(async (error: unknown) => {
        if (problemOf(error) === 'stale' && (await reloadIntoNewerBuild())) return reloading()
        throw error
      }),
    enabled: isBackendConfigured && token !== '',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  const claim = useMutation({
    mutationFn: (_message: string) => claimPlan(token),
    onSuccess: (_claimed, message) => {
      handFirstMessage(message)
      void navigate(routes.saoirse, { replace: true })
    },
  })

  const problem: ClaimProblem | null = !isBackendConfigured
    ? 'failed'
    : token === ''
      ? 'unknown'
      : preview.isError
        ? problemOf(preview.error)
        : claim.isError
          ? problemOf(claim.error)
          : null
  const claiming = claim.isPending || claim.isSuccess
  const startAgain = (): void => {
    void navigate(routes.saoirse, { replace: true })
  }
  const send = (message: string): void => {
    setSent(message)
    claim.mutate(message)
  }

  /*
   * The card is taller than a phone, so the question would sit below the fold. The screen opens
   * on the top of the card, the same view as the host's, then follows the conversation down to
   * Saoirse's question after a beat, as a chat lands on its newest message; and to whatever comes
   * after it (their message, a refusal) at once.
   */
  const end = useRef<HTMLDivElement>(null)
  const landed = useRef(false)
  const settled = preview.data !== undefined || problem !== null
  useEffect(() => {
    const element = end.current
    if (!settled || element === null || typeof element.scrollIntoView !== 'function') return
    const still =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const follow = (): void => {
      landed.current = true
      element.scrollIntoView({ block: 'end', behavior: still ? 'auto' : 'smooth' })
    }
    if (landed.current) {
      follow()
      return
    }
    const timer = window.setTimeout(follow, 700)
    return () => {
      window.clearTimeout(timer)
    }
  }, [settled, sent, problem, claiming])

  return (
    <div className={className}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        {preview.data !== undefined && !preview.isError && (
          <>
            {/* Not a bubble: the card and the notice take the full column (2026-11-12), so the
                tiles have room at 390px; only Saoirse's line below keeps the avatar indent. */}
            <ArrivalCard preview={preview.data} />
            <Link
              to={routes.privacy}
              className="bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-11 items-center rounded-md px-3 py-2 text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Click here for the data protection notice
            </Link>
            <ChatBubble author="assistant" first>
              <p>{preview.data.opening}</p>
            </ChatBubble>
            {sent !== null && (
              <ChatBubble author="customer">
                <p>{sent}</p>
              </ChatBubble>
            )}
          </>
        )}
        {problem !== null ? (
          <>
            <ChatBubble author="assistant" first={preview.data === undefined}>
              <p>{PROBLEM_LINES[problem]}</p>
            </ChatBubble>
            <SuggestionList
              className="pl-10"
              suggestions={chipsFor(problem)}
              onSelect={(suggestion) => {
                if (suggestion.id === 'again') startAgain()
                else if (suggestion.id === 'reload') reloadPage()
                else if (preview.isError) void preview.refetch()
                else if (sent !== null) claim.mutate(sent)
                else claim.reset()
              }}
            />
          </>
        ) : preview.data === undefined || claiming ? (
          <TypingBubble first={preview.data === undefined} />
        ) : null}
        <div ref={end} aria-hidden />
      </div>
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 shrink-0 border-t px-4 pt-2.5 pb-[max(0.625rem,var(--safe-bottom))] backdrop-blur">
        <Composer
          hint={false}
          disabled={preview.data === undefined || problem !== null || claiming}
          onSend={send}
          {...(problem === null
            ? {}
            : { placeholder: problem === 'stale' ? 'Reload to chat' : 'Start again to chat' })}
        />
      </div>
    </div>
  )
}

const START_AGAIN = { id: 'again', label: 'Start again' } as const

/**
 * What can help, for each problem. Trying again helps only when the server may answer
 * differently in a moment; an old page reads every answer the same way, so it gets a reload.
 */
function chipsFor(problem: ClaimProblem): Suggestion[] {
  switch (problem) {
    case 'busy':
    case 'failed':
      return [{ id: 'retry', label: 'Try again' }, START_AGAIN]
    case 'stale':
      return [{ id: 'reload', label: 'Reload' }, START_AGAIN]
    case 'unknown':
    case 'used':
    case 'expired':
      return [START_AGAIN]
  }
}

/** The arrival card when the preview carries one, else the compact card, as in the chat. */
function ArrivalCard({ preview }: { preview: PreviewPlanResponse }): ReactNode {
  const planRoutes = routesOf(preview)
  if (preview.arrival !== null) {
    return <PlanArrivalCard arrival={preview.arrival} routes={planRoutes} />
  }
  return <CompactPlanCard plan={compactOf(preview, planRoutes)} />
}

/** A preview in the compact card's terms, so an older plan looks as it will in the chat. */
function compactOf(preview: PreviewPlanResponse, planRoutes: CompactPlan['routes']): CompactPlan {
  return {
    title: preview.title,
    figures: preview.figures,
    ...(preview.comparison === null ? {} : { comparison: preview.comparison }),
    products: preview.products.map((product) => ({
      name: product.name,
      providerName: product.provider,
      amounts: product.line === '' ? [] : [product.line],
      rate: null,
    })),
    routes: planRoutes,
  }
}

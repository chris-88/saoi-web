import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SaoiWordmark } from '@/saoirse/SaoiWordmark'
import { CLAIM_COPY, NOTICE, problemOf, type ClaimProblem } from '@/lib/planClaim'
import { queryKeys } from '@/lib/queryKeys'
import { claimPlan, previewPlan } from '@/lib/session'
import { isBackendConfigured } from '@/lib/env'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { routes } from '@/app/routes'
import type { PreviewPlanResponse } from '@contracts/session.ts'

/**
 * `#/plan/:token`: a comparison saved in the customer's own AI, arriving in the app.
 *
 * One step at a time (Chris, 2026-11-10): the welcome shows the comparison straight away, read
 * without spending the link; then what Saoi keeps, before anything is stored against them; then
 * the claim, which puts the comparison in this browser's conversation, and the chat, whose
 * return turn shows the card and Saoirse's opening on it. The token is opaque and spent only by
 * the claim (Invariant 8); the address is replaced on the way to the chat.
 */
export function PlanClaim(): ReactNode {
  useDocumentTitle('Your saved comparison')
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<'welcome' | 'notice'>('welcome')

  const preview = useQuery({
    queryKey: queryKeys.plans.preview(token),
    queryFn: () => previewPlan(token),
    enabled: isBackendConfigured && token !== '',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  const claim = useMutation({ mutationFn: () => claimPlan(token) })

  useEffect(() => {
    if (claim.isSuccess) void navigate(routes.saoirse, { replace: true })
  }, [claim.isSuccess, navigate])

  const problem: ClaimProblem | null = !isBackendConfigured
    ? 'failed'
    : token === ''
      ? 'unknown'
      : preview.isError
        ? problemOf(preview.error)
        : claim.isError
          ? problemOf(claim.error)
          : null

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-md items-center px-4 py-3">
          <SaoiWordmark className="h-5" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-6">
        {problem !== null ? (
          <Problem
            problem={problem}
            retry={
              problem === 'busy' || problem === 'failed'
                ? () => {
                    if (preview.isError) void preview.refetch()
                    else claim.reset()
                  }
                : null
            }
          />
        ) : preview.data === undefined ? (
          <section className="space-y-3" aria-busy="true" aria-live="polite">
            <p className="text-muted-foreground text-sm">Opening your saved comparison…</p>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </section>
        ) : step === 'welcome' ? (
          <Welcome
            preview={preview.data}
            onContinue={() => {
              setStep('notice')
            }}
          />
        ) : (
          <Notice
            busy={claim.isPending || claim.isSuccess}
            onContinue={() => {
              claim.mutate()
            }}
          />
        )}
      </main>
    </div>
  )
}

function Welcome({
  preview,
  onContinue,
}: {
  readonly preview: PreviewPlanResponse
  readonly onContinue: () => void
}): ReactNode {
  const comparison = preview.comparison
  return (
    <section className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Welcome to Saoi</h1>
        <p className="text-muted-foreground text-sm">
          Here’s the comparison you saved in your AI assistant.
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="space-y-1 p-4">
          <p className="font-medium">{preview.title}</p>
          {preview.figures !== '' && (
            <p className="text-muted-foreground text-sm tabular-nums">{preview.figures}</p>
          )}
        </div>
        {comparison !== null ? (
          <div className="border-t px-4 pb-2">
            <p className="text-muted-foreground pt-3 text-xs">{comparison.sortedBy}</p>
            {comparison.filters.map((filter) => (
              <p key={filter} className="text-muted-foreground text-xs">
                {filter}
              </p>
            ))}
            <ol className="divide-y" aria-label="The first options, in the order you chose">
              {comparison.options.map((option, index) => (
                <li key={index} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {option.lender}
                      {!option.confirmed && (
                        <Badge variant="outline" className="ml-2 align-middle font-normal">
                          Unconfirmed
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {option.kind} · {option.rate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{option.fiveYear}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">{option.monthly}</p>
                  </div>
                </li>
              ))}
            </ol>
            {comparison.total > comparison.options.length && (
              <p className="text-muted-foreground pb-2 text-xs">
                {comparison.total - comparison.options.length} more options come with it.
              </p>
            )}
          </div>
        ) : (
          preview.products.length > 0 && (
            <ol className="divide-y border-t px-4">
              {preview.products.map((product, index) => (
                <li key={index} className="flex justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{product.name}</span>
                    <span className="text-muted-foreground block text-xs">{product.provider}</span>
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">{product.line}</span>
                </li>
              ))}
            </ol>
          )
        )}
      </div>

      <Button className="h-11 w-full" onClick={onContinue}>
        Continue
      </Button>
      <p className="text-muted-foreground text-xs">
        Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares
        products on the figures you give.
      </p>
    </section>
  )
}

function Notice({
  busy,
  onContinue,
}: {
  readonly busy: boolean
  readonly onContinue: () => void
}): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <section className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{NOTICE.title}</h1>
        <p className="text-muted-foreground text-sm">{NOTICE.lead}</p>
      </div>
      <ul className="space-y-3 text-sm">
        {NOTICE.points.map((point) => (
          <li key={point.label} className="grid gap-0.5">
            <span className="font-medium">{point.label}</span>
            <span className="text-muted-foreground">{point.text}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-medium"
          aria-expanded={open}
          aria-controls="full-notice"
          onClick={() => {
            setOpen((value) => !value)
          }}
        >
          Read the full notice
          <ChevronDown
            className={`text-muted-foreground size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <div id="full-notice" hidden={!open} className="space-y-3 border-t px-4 py-3 text-sm">
          {NOTICE.full.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <p className="font-medium">{item.label}</p>
              <p className="text-muted-foreground">{item.text}</p>
            </div>
          ))}
          <p>
            <Link to={routes.privacy} className="underline underline-offset-4">
              How your data is used
            </Link>
          </p>
        </div>
      </div>
      <Button className="h-11 w-full" disabled={busy} onClick={onContinue}>
        {busy ? 'Opening…' : 'Continue'}
      </Button>
    </section>
  )
}

function Problem({
  problem,
  retry,
}: {
  readonly problem: ClaimProblem
  readonly retry: (() => void) | null
}): ReactNode {
  return (
    <section className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{CLAIM_COPY[problem].title}</h1>
        <p className="text-muted-foreground text-sm">{CLAIM_COPY[problem].body}</p>
      </div>
      <div className="grid gap-2">
        {retry !== null && (
          <Button className="h-11" onClick={retry}>
            Try again
          </Button>
        )}
        <Button asChild className="h-11" variant={retry === null ? 'default' : 'outline'}>
          <Link to={routes.saoirse} replace>
            Start a fresh chat with Saoirse
          </Link>
        </Button>
      </div>
    </section>
  )
}

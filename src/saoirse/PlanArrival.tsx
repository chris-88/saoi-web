import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { ChatBubble } from '@/saoirse/ChatBubble'
import { Composer } from '@/saoirse/Composer'
import { SuggestionList } from '@/saoirse/SuggestionList'
import { TypingBubble } from '@/saoirse/TypingBubble'
import { NOTICE, PROBLEM_LINES, problemOf, type ClaimProblem } from '@/lib/planClaim'
import { ACCEPT_LABEL, handArrivalToChat, welcomeLine } from '@/lib/planArrival'
import { claimPlan, previewPlan } from '@/lib/session'
import { isBackendConfigured } from '@/lib/env'
import { queryKeys } from '@/lib/queryKeys'
import { routes } from '@/app/routes'
import { cn } from '@/lib/utils'

/**
 * A saved comparison arriving in the chat (Chris, 2026-11-10: "the conversation just carries
 * on"). Saoirse's first two messages, the welcome and the data notice, are shown here, in the
 * chat's own layout, before anything is stored: the comparison is read by the public preview,
 * no session is started and the composer waits. Accepting claims it (the token is spent only
 * then, Invariant 8) and hands over to the chat, which carries these messages on and shows
 * the card and Saoirse's next line. A link that cannot be opened is a message too, with a
 * chip to start again.
 */
export function PlanArrival({
  token,
  className,
}: {
  token: string
  className?: string | undefined
}): ReactNode {
  const navigate = useNavigate()
  const [openNotice, setOpenNotice] = useState(false)

  const preview = useQuery({
    queryKey: queryKeys.plans.preview(token),
    queryFn: () => previewPlan(token),
    enabled: isBackendConfigured && token !== '',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  const claim = useMutation({
    mutationFn: () => claimPlan(token),
    onSuccess: () => {
      if (preview.data === undefined) return
      handArrivalToChat({
        welcome: welcomeLine(preview.data.title),
        notice: NOTICE.lines,
        accepted: ACCEPT_LABEL,
      })
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
  const accepting = claim.isPending || claim.isSuccess
  const startAgain = (): void => {
    void navigate(routes.saoirse, { replace: true })
  }

  return (
    <div className={className}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        {problem !== null ? (
          <>
            <ChatBubble author="assistant">
              <p>{PROBLEM_LINES[problem]}</p>
            </ChatBubble>
            <SuggestionList
              className="pl-10"
              suggestions={
                problem === 'busy' || problem === 'failed'
                  ? [
                      { id: 'retry', label: 'Try again' },
                      { id: 'again', label: 'Start again' },
                    ]
                  : [{ id: 'again', label: 'Start again' }]
              }
              onSelect={(suggestion) => {
                if (suggestion.id === 'again') startAgain()
                else if (preview.isError) void preview.refetch()
                else claim.reset()
              }}
            />
          </>
        ) : preview.data === undefined ? (
          <TypingBubble first />
        ) : (
          <>
            <ChatBubble author="assistant" showAvatar={false} first>
              <p>{welcomeLine(preview.data.title)}</p>
            </ChatBubble>
            <ChatBubble author="assistant">
              <div className="space-y-2">
                {NOTICE.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <button
                  type="button"
                  className="text-primary inline-flex min-h-11 items-center gap-1 font-medium underline-offset-4 hover:underline"
                  aria-expanded={openNotice}
                  aria-controls="full-notice"
                  onClick={() => {
                    setOpenNotice((value) => !value)
                  }}
                >
                  Read the full notice
                  <ChevronDown
                    aria-hidden
                    className={cn('size-4 transition-transform', openNotice && 'rotate-180')}
                  />
                </button>
                <div id="full-notice" hidden={!openNotice} className="space-y-2 border-t pt-2">
                  {NOTICE.full.map((item) => (
                    <p key={item.label}>
                      <span className="font-medium">{item.label}. </span>
                      <span className="text-muted-foreground">{item.text}</span>
                    </p>
                  ))}
                </div>
              </div>
            </ChatBubble>
            {accepting ? (
              <>
                <ChatBubble author="customer">
                  <p>{ACCEPT_LABEL}</p>
                </ChatBubble>
                <TypingBubble />
              </>
            ) : (
              <SuggestionList
                className="pl-10"
                suggestions={[{ id: 'accept', label: ACCEPT_LABEL }]}
                onSelect={() => {
                  claim.mutate()
                }}
              />
            )}
          </>
        )}
      </div>
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 shrink-0 border-t px-4 pt-2.5 pb-[max(0.625rem,var(--safe-bottom))] backdrop-blur">
        <Composer
          hint={false}
          disabled
          onSend={() => undefined}
          placeholder={
            problem === null ? 'Tap “That’s fine, carry on” to start' : 'Start again to chat'
          }
        />
      </div>
    </div>
  )
}

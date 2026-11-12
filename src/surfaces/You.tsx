import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  House,
  Landmark,
  LogIn,
  LogOut,
  MessageSquare,
  MessageSquareHeart,
  Plus,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { NotFound } from '@/components/NotFound'
import { SaoirseWordmark } from '@/saoirse/SaoirseWordmark'
import { SignInForm } from '@/saoirse/SignInForm'
import { FeedbackSheet } from '@/saoirse/FeedbackSheet'
import { HoldingsSection } from '@/saoirse/HoldingsSection'
import { RemindersSection } from '@/saoirse/RemindersSection'
import { NotificationsSection } from '@/saoirse/NotificationsSection'
import { LinkedAccountsSection } from '@/saoirse/LinkedAccountsSection'
import { ConversationsSection } from '@/saoirse/ConversationsSection'
import { currentCaseId, useCases } from '@/api/cases'
import { useLinkedAccounts, useNotifications } from '@/api/snapshot'
import { initialsOf, useIdentity } from '@/saoirse/useIdentity'
import { useCaseHoldings } from '@/api/holdings'
import { useCasePlan } from '@/api/plan'
import { planStateLine } from '@/lib/plan'
import { ButtonRow, Group, GroupLabel, LinkRow } from '@/surfaces/YouRows'
import { PlanSection } from '@/surfaces/YourPlan'
import { isAssetKind, type Holding } from '@contracts/holdings.ts'
import { lastKnownAddress, signOutIdentity } from '@/lib/identity'
import { startNewCase } from '@/lib/session'
import { landOnChat } from '@/lib/landOnChat'
import { isYouSection, routes, type YouSection } from '@/app/routes'
import { cn } from '@/lib/utils'

/**
 * You (2026-11-12): who is signed in, and everything about the conversation that is not the
 * conversation.
 *
 * It replaced a hamburger on the left of the chat that opened a drawer with seven sections
 * stacked in one scroll. Each of those is a page of its own now, reached from a row here, so
 * the first screen is a list a thumb can scan and nothing loads until it is asked for. The
 * rule is the chat's rule: a little at a time, detail when it is wanted.
 *
 * The case comes from the conversation list rather than from `session start`: a second start
 * racing the chat's on a cold load is how one visitor came to own two conversations.
 */
export function You(): ReactNode {
  const { section } = useParams<{ section?: string }>()
  if (section === undefined) return <Overview />
  if (!isYouSection(section)) return <NotFound />
  return <SectionPage section={section} />
}

/** The chat header's chrome, with a way back where the hamburger used to be. */
function Shell({
  backTo,
  backLabel,
  title,
  children,
}: {
  readonly backTo: string
  readonly backLabel: string
  readonly title: string
  readonly children: ReactNode
}): ReactNode {
  useDocumentTitle(title)
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-30 shrink-0 border-b backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-[2.25rem_1fr_2.25rem] items-center px-2 py-2">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link to={backTo} aria-label={backLabel}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <Link
            to={routes.saoirse}
            aria-label="Saoirse home"
            className="hover:bg-accent focus-visible:ring-ring justify-self-center rounded-md px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <SaoirseWordmark className="h-6" />
          </Link>
          <span aria-hidden />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-5 pb-[max(2rem,var(--safe-bottom))]">
        {children}
      </main>
    </div>
  )
}

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** "€33,000 saved · €6,500 owed", or what there is of it. */
function moneyLine(holdings: readonly Holding[]): string | undefined {
  if (holdings.length === 0) return undefined
  let saved = 0
  let owed = 0
  for (const holding of holdings) {
    if (isAssetKind(holding.kind)) saved += holding.balance
    else owed += holding.balance
  }
  return [
    saved > 0 ? `${euro.format(saved)} saved` : null,
    owed > 0 ? `${euro.format(owed)} owed` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

function Overview(): ReactNode {
  const identity = useIdentity()
  const cases = useCases()
  const caseId = currentCaseId(cases.data)

  /*
   * Summaries for the rows that are cheap to know. Reminders are left out on purpose: reading
   * them marks the plan alerts seen on the server, which should happen when they are looked
   * at, not when the page that lists them is passed through.
   */
  const holdings = useCaseHoldings(caseId)
  const plan = useCasePlan(caseId)
  const notifications = useNotifications(caseId)
  const linked = useLinkedAccounts(caseId)

  const begin = useMutation({ mutationFn: () => startNewCase('new'), onSuccess: landOnChat })
  const signOut = useMutation({
    mutationFn: () => signOutIdentity(),
    // A different person now, so every case-shaped thing on screen belongs to somebody else.
    onSuccess: landOnChat,
  })

  const known = lastKnownAddress()
  const [signingIn, setSigningIn] = useState(known !== null)
  const name = identity.name ?? 'Signed in'
  const linkedCount = linked.data?.length ?? 0

  return (
    <Shell backTo={routes.saoirse} backLabel="Back to Saoirse" title="You">
      <h1 className="sr-only">You</h1>

      {/* Who this is. Sign-in lives here for whoever has no card on screen offering it. */}
      <section aria-label="Your account" className="bg-card rounded-xl border p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {identity.avatarUrl !== null && <AvatarImage src={identity.avatarUrl} alt="" />}
            <AvatarFallback className={cn(identity.anonymous && 'bg-muted text-muted-foreground')}>
              {identity.anonymous ? <UserRound className="size-5" /> : initialsOf(identity.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">
              {identity.anonymous ? 'Not signed in' : name}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {identity.anonymous
                ? 'This conversation lives in this browser only.'
                : (identity.email ?? 'The conversation follows you between devices.')}
            </p>
          </div>
          {!identity.anonymous && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground shrink-0"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          )}
        </div>
        {signOut.isError && (
          <p className="text-destructive mt-2 text-xs">{signOut.error.message}</p>
        )}

        {identity.anonymous && (
          <div className="mt-4 border-t pt-4">
            {/*
             * The way back in, for somebody who has been here before: the same two steps as
             * the card Saoirse offers in the conversation, reachable without being offered. A
             * person returning on a new phone has no card on screen and no conversation to be
             * offered one in. An address they have used before brings the conversation with it.
             *
             * Behind one tap, not open by default: the form is the tallest thing on the page,
             * and most people here came for a row below it. It opens by itself when this
             * browser has an address to offer back, which is the one-tap case.
             */}
            <p className="text-muted-foreground text-xs leading-relaxed">
              Sign in and this conversation follows you: the same one on your phone, your laptop and
              anywhere else you open Saoirse.
            </p>
            {signingIn ? (
              <div className="mt-3">
                <SignInForm {...(known === null ? {} : { knownAddress: known })} />
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setSigningIn(true)}
              >
                <LogIn className="size-4" />
                Sign in
              </Button>
            )}
          </div>
        )}
      </section>

      <Button className="mt-4 w-full" disabled={begin.isPending} onClick={() => begin.mutate()}>
        <Plus className="size-4" />
        Start a new conversation
      </Button>
      {begin.isError && <p className="text-destructive mt-2 text-xs">{begin.error.message}</p>}

      {cases.isError && (
        <p className="text-destructive mt-4 text-xs leading-relaxed">
          Your conversation could not be looked up, so the figures below are missing.{' '}
          {cases.error.message}
        </p>
      )}

      <div className="mt-6">
        <GroupLabel>This conversation</GroupLabel>
        <Group>
          {/*
            Only with a plan claimed on the case: hidden, not greyed, without one. While it is
            being looked up nothing is shown, so the row does not flash in and out.
          */}
          {plan.data !== undefined && plan.data !== null && (
            <LinkRow
              to={routes.youSection('plan')}
              icon={<House />}
              label="Your plan"
              detail={planStateLine(plan.data) ?? plan.data.title}
            />
          )}
          {plan.isError && (
            <LinkRow
              to={routes.youSection('plan')}
              icon={<House />}
              label="Your plan"
              detail="Could not be looked up just now"
            />
          )}
          <LinkRow
            to={routes.youSection('money')}
            icon={<Wallet />}
            label="Your money"
            detail={
              holdings.data === undefined
                ? 'What you have saved and what you owe'
                : (moneyLine(holdings.data.holdings) ?? 'Nothing entered yet')
            }
          />
          <LinkRow
            to={routes.youSection('reminders')}
            icon={<CalendarClock />}
            label="Reminders"
            detail="Dates you gave, and alerts about your plan"
          />
          <LinkRow
            to={routes.youSection('notifications')}
            icon={<Bell />}
            label="Notifications"
            detail={
              notifications.data === undefined
                ? 'What Saoirse has told you, and this device'
                : notifications.data.length === 0
                  ? 'Nothing yet'
                  : (notifications.data[0]?.title ?? '')
            }
            value={
              notifications.data !== undefined && notifications.data.length > 0
                ? String(notifications.data.length)
                : undefined
            }
          />
          {/*
            Only while something is shared. The consent screen promised "stop it any time from
            the menu", so this is where that promise is kept; with nothing linked there is
            nothing to stop, and a row saying so is noise.
          */}
          {linkedCount > 0 && (
            <LinkRow
              to={routes.youSection('linked')}
              icon={<Landmark />}
              label="Linked accounts"
              detail={[...new Set(linked.data?.map((account) => account.bank) ?? [])].join(', ')}
              value={String(linkedCount)}
            />
          )}
        </Group>
      </div>

      <div className="mt-6">
        <GroupLabel>Saoirse</GroupLabel>
        <Group>
          <LinkRow
            to={routes.youSection('conversations')}
            icon={<MessageSquare />}
            label="Conversations"
            detail={
              cases.data === undefined
                ? 'Everything you have started with Saoirse'
                : cases.data.presenter
                  ? 'Presenter mode: every conversation on this system'
                  : 'Everything you have started with Saoirse'
            }
            value={cases.data === undefined ? undefined : String(cases.data.cases.length)}
          />
          {/*
            Asked for here, not in the transcript (§44). The thumbs under each reply are about
            one answer; this is about the whole thing, and this page is the one place that is
            about the conversation rather than in it.
          */}
          <FeedbackSheet
            caseId={caseId}
            trigger={
              <ButtonRow
                icon={<MessageSquareHeart />}
                label="Feedback"
                detail="A person reads every word"
                disabled={caseId === null}
              />
            }
          />
          <LinkRow
            to={routes.privacy}
            icon={<ShieldCheck />}
            label="How your data is used"
            detail="What is kept, and who sees it"
          />
        </Group>
      </div>

      <p className="text-muted-foreground mt-8 text-center text-xs leading-relaxed">
        Saoirse is a working prototype, not a banking service.
      </p>
    </Shell>
  )
}

const SECTION: Readonly<
  Record<
    YouSection,
    { readonly title: string; readonly lead: string | ((presenter: boolean) => string) }
  >
> = {
  plan: {
    title: 'Your plan',
    lead: 'The plan you saved, as it stands. Change a figure and Saoirse says what it does.',
  },
  money: {
    title: 'Your money',
    lead: 'What you have saved and what you owe, as Saoirse knows it. Facts only; nothing here tells you what to do.',
  },
  reminders: {
    title: 'Reminders',
    lead: 'The dates you gave Saoirse, each with a way to delete it, and the latest alerts about your plan.',
  },
  notifications: {
    title: 'Notifications',
    lead: 'What Saoirse has sent you, and whether this device hears about the next one.',
  },
  linked: {
    title: 'Linked accounts',
    lead: 'What is being shared through Nexus, and the way to stop it.',
  },
  conversations: {
    title: 'Conversations',
    lead: (presenter) =>
      presenter
        ? 'Presenter mode: every conversation on this system. Tap one to jump into it.'
        : 'Everything you have started with Saoirse. Tap one to go back to it.',
  },
}

function SectionPage({ section }: { readonly section: YouSection }): ReactNode {
  const cases = useCases()
  const caseId = currentCaseId(cases.data)
  const { title, lead } = SECTION[section]

  return (
    <Shell backTo={routes.you} backLabel="Back to You" title={title}>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm leading-relaxed">
        {typeof lead === 'function' ? lead(cases.data?.presenter ?? false) : lead}
      </p>
      <SectionBody section={section} caseId={caseId} pendingCase={cases.isPending} />
    </Shell>
  )
}

function SectionBody({
  section,
  caseId,
  pendingCase,
}: {
  readonly section: YouSection
  readonly caseId: string | null
  readonly pendingCase: boolean
}): ReactNode {
  switch (section) {
    case 'conversations':
      return <ConversationsSection />
    case 'notifications':
      return <NotificationsSection caseId={caseId} />
    case 'linked':
      return <LinkedAccountsSection caseId={caseId} />
    case 'plan':
    case 'money':
    case 'reminders': {
      if (caseId === null) {
        return pendingCase ? (
          <p className="text-muted-foreground text-sm">Looking it up…</p>
        ) : (
          <NoConversationYet />
        )
      }
      if (section === 'plan') return <PlanSection caseId={caseId} />
      return section === 'money' ? (
        <HoldingsSection caseId={caseId} enabled heading={false} />
      ) : (
        <RemindersSection caseId={caseId} enabled heading={false} />
      )
    }
  }
}

function NoConversationYet(): ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Nothing here until you have said something to Saoirse.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to={routes.saoirse}>Go to Saoirse</Link>
      </Button>
    </div>
  )
}

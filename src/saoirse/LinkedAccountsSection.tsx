import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { runCaseAction } from '@/lib/caseActions'
import { useLinkedAccounts } from '@/api/snapshot'
import { longDate } from '@/lib/when'

export const NOTHING_LINKED =
  'Nothing is being shared. Saoirse will offer to link an account when it would help.'

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`
}

/**
 * The "Linked accounts" page under You: what is being shared, and the way to stop it.
 *
 * The consent screen promised "stop it any time from the menu", so this is where that promise
 * is kept. Revoking is a `case-action` like any other commitment, and it removes everything
 * read under the consent, so it asks first. The card in the conversation settles to "stopped
 * sharing" on its own: the state comes from the database, not from this page.
 */
export function LinkedAccountsSection({ caseId }: { caseId: string | null }): ReactNode {
  const queryClient = useQueryClient()
  const linked = useLinkedAccounts(caseId)
  const [confirming, setConfirming] = useState(false)

  const revoke = useMutation({
    mutationFn: () => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return runCaseAction({ action: 'revoke_accounts', caseId })
    },
    onSuccess: async () => {
      setConfirming(false)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.case.linkedAccounts(caseId ?? 'none'),
      })
    },
  })

  if (caseId !== null && supabase !== null && linked.isPending) {
    return <p className="text-muted-foreground text-sm">Looking them up…</p>
  }
  if (linked.isError) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">
          Your linked accounts would not load. {linked.error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => void linked.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const accounts = linked.data ?? []
  if (accounts.length === 0) {
    return <p className="text-muted-foreground text-sm leading-relaxed">{NOTHING_LINKED}</p>
  }

  const banks = [...new Set(accounts.map((account) => account.bank))]
  const until = accounts[0]?.consentUntil ?? null

  return (
    <div className="space-y-4">
      <ul className="bg-card divide-y rounded-lg border shadow-xs" aria-label="Linked accounts">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0 truncate text-sm">
              <span className="font-medium">{account.bank}</span>
              <span className="text-muted-foreground"> · {account.displayName}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Shared through Nexus{until === null ? '' : ` until ${longDate(until)}`}. Balances and
        transactions only; nothing moves unless you tap.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={revoke.isPending}
        onClick={() => setConfirming(true)}
      >
        Stop sharing
      </Button>
      {revoke.isError && <p className="text-destructive text-xs">{revoke.error.message}</p>}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop sharing with Saoirse?</AlertDialogTitle>
            <AlertDialogDescription>
              Nexus stops sharing your {joinNames(banks)} accounts, and everything Saoirse read
              under that consent is removed. You can link them again whenever you like.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep sharing</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Stays open until the server has answered, so a failure has somewhere to show.
                event.preventDefault()
                revoke.mutate()
              }}
            >
              {revoke.isPending ? 'Stopping…' : 'Stop sharing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

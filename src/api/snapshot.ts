import { useQuery } from '@tanstack/react-query'
import { LINKABLE_BANKS } from '@contracts/cards.ts'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { fetchCaseSnapshot } from '@/lib/saoiApi'

/** Two reads of the case snapshot for the pages under You. */

export type Notification = {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly at: string
}

/** What Saoirse has sent, newest first. */
export function useNotifications(caseId: string | null, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.case.events(caseId ?? 'none'),
    enabled: enabled && caseId !== null && supabase !== null,
    queryFn: async (): Promise<readonly Notification[]> => {
      if (!supabase || !caseId) return []
      return (await fetchCaseSnapshot(caseId)).notifications
    },
  })
}

export type LinkedAccount = {
  readonly id: string
  readonly bank: string
  readonly displayName: string
  readonly consentUntil: string
}

/**
 * The accounts the customer has let Nexus share.
 *
 * Only consents still standing: a revoked row stays in the table for the card that offered
 * it to settle against, but it is nothing the customer needs to see here.
 */
export function useLinkedAccounts(caseId: string | null, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.case.linkedAccounts(caseId ?? 'none'),
    enabled: enabled && caseId !== null && supabase !== null,
    queryFn: async (): Promise<readonly LinkedAccount[]> => {
      if (!supabase || !caseId) return []
      const { linkedAccounts } = await fetchCaseSnapshot(caseId)
      return linkedAccounts
        .filter((account) => account.revokedAt === null)
        .map((account) => ({
          id: account.id,
          bank: LINKABLE_BANKS.find((bank) => bank.id === account.bank)?.name ?? account.bank,
          displayName: account.displayName,
          consentUntil: account.consentExpiresAt,
        }))
    },
  })
}

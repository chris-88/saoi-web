import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateHoldingBody, UpdateHoldingBody } from '@contracts/holdings.ts'
import { createHolding, deleteHolding, fetchCaseHoldings, updateHolding } from '@/lib/saoiApi'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Accounts and debts entered by hand, and progress against the plan (saoi
 * `contracts/holdings.ts`, 2026-11-11).
 *
 * Saoirse records holdings from the conversation too, so the list is read fresh whenever it is
 * shown (`staleTime: 0`) and the chat invalidates it after each turn.
 */
export function useCaseHoldings(
  caseId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.case.holdings(caseId ?? 'none'),
    enabled: enabled && caseId !== null,
    queryFn: () => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return fetchCaseHoldings(caseId)
    },
    staleTime: 0,
  })
}

/**
 * After a change: the holdings and progress, and the reminders (a `fixedUntil` keeps one, and
 * deleting a holding deletes it).
 */
function useRefresh(caseId: string | null) {
  const queryClient = useQueryClient()
  const id = caseId ?? 'none'
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.case.holdings(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.case.alerts(id) }),
    ])
}

/** Adds an account or a debt, then reads the list again. */
export function useCreateHolding(caseId: string | null) {
  const refresh = useRefresh(caseId)
  return useMutation({
    mutationFn: (body: CreateHoldingBody) => {
      if (caseId === null) throw new Error('There is no conversation to add that to yet.')
      return createHolding(caseId, body)
    },
    onSuccess: refresh,
  })
}

/** Changes a holding, then reads the list again. */
export function useUpdateHolding(caseId: string | null) {
  const refresh = useRefresh(caseId)
  return useMutation({
    mutationFn: ({ holdingId, body }: { holdingId: string; body: UpdateHoldingBody }) => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return updateHolding(caseId, holdingId, body)
    },
    onSuccess: refresh,
  })
}

/** Deletes a holding (and its reminder), then reads the list again. */
export function useDeleteHolding(caseId: string | null) {
  const refresh = useRefresh(caseId)
  return useMutation({
    mutationFn: (holdingId: string) => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return deleteHolding(caseId, holdingId)
    },
    onSuccess: refresh,
  })
}

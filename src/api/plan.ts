import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CasePlan, CasePlanChoiceBody, CasePlanEdit } from '@contracts/case-plan.ts'
import { SaoiApiError } from '@/api/client'
import { choosePlanProduct, fetchCasePlan, removePlanChoice, updateCasePlan } from '@/lib/saoiApi'
import { queryKeys } from '@/lib/queryKeys'
import type { PlanChoiceSlot } from '@contracts/market-plan.ts'

/**
 * The plan claimed on the case ("Your plan" under You). `null` when the case has none, which
 * hides the row rather than greying it.
 *
 * Saoirse changes the plan from the conversation too, so it is read fresh whenever it is shown.
 */
export function useCasePlan(caseId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.case.plan(caseId ?? 'none'),
    enabled: enabled && caseId !== null,
    queryFn: () => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return fetchCasePlan(caseId)
    },
    staleTime: 0,
  })
}

/**
 * Changes the plan's own figures. An edit moves more than the plan (progress, the reminders,
 * the comparison), so every query on the case is read again afterwards.
 */
export function useUpdateCasePlan(caseId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CasePlanEdit) => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return updateCasePlan(caseId, body)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.case.detail(caseId ?? 'none') }),
    // The plan has gone (a 404): read it again, so the page says there is none.
    onError: (error) =>
      error instanceof SaoiApiError && error.status === 404
        ? queryClient.invalidateQueries({ queryKey: queryKeys.case.plan(caseId ?? 'none') })
        : undefined,
  })
}

/**
 * The plan as the cards read it, for the chosen badges and the plan card's choices. One read
 * shared by every card on the screen (the same query as Your plan), held for half a minute
 * rather than read again by each card as it mounts; a choice made or removed invalidates it.
 * `null` with no plan or no case, or while it loads or fails.
 */
export function usePlanForCards(caseId: string | null): CasePlan | null {
  const plan = useQuery({
    queryKey: queryKeys.case.plan(caseId ?? 'none'),
    enabled: caseId !== null,
    queryFn: () => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return fetchCasePlan(caseId)
    },
    staleTime: 30_000,
    // A badge is a nicety: a failed read shows none, and the chat says nothing about it.
    retry: false,
  })
  return plan.data ?? null
}

/**
 * The customer's tap choosing a product for a slot of the plan. Everything on the case is read
 * again afterwards: the plan and its choices, and the cards' badges with them.
 */
export function useChoosePlanProduct(caseId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CasePlanChoiceBody) => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return choosePlanProduct(caseId, body)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.case.detail(caseId ?? 'none') }),
  })
}

/** Clears one slot's choice, then reads the case again. */
export function useRemovePlanChoice(caseId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slot: PlanChoiceSlot) => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return removePlanChoice(caseId, slot)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.case.detail(caseId ?? 'none') }),
  })
}

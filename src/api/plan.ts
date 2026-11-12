import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CasePlanEdit } from '@contracts/case-plan.ts'
import { SaoiApiError } from '@/api/client'
import { fetchCasePlan, updateCasePlan } from '@/lib/saoiApi'
import { queryKeys } from '@/lib/queryKeys'

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

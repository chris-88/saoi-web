import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateReminderBody } from '@contracts/alerts.ts'
import { createReminder, deleteReminder, fetchCaseAlerts } from '@/lib/saoiApi'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Plan alerts and dated reminders on a case (saoi `contracts/alerts.ts`, 2026-11-11).
 *
 * Reading the alerts marks them seen on the server, so the query runs only when asked for
 * (`enabled`: the menu is open) and is not refetched behind the customer's back on focus.
 */
export function useCaseAlerts(
  caseId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.case.alerts(caseId ?? 'none'),
    enabled: enabled && caseId !== null,
    queryFn: () => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return fetchCaseAlerts(caseId)
    },
    refetchOnWindowFocus: false,
  })
}

/** Sets a reminder, then reads the list again. */
export function useCreateReminder(caseId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateReminderBody) => {
      if (caseId === null) throw new Error('There is no conversation to set that on yet.')
      return createReminder(caseId, body)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.case.alerts(caseId ?? 'none') }),
  })
}

/** Deletes a reminder, then reads the list again. */
export function useDeleteReminder(caseId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reminderId: string) => {
      if (caseId === null) throw new Error('There is no conversation yet.')
      return deleteReminder(caseId, reminderId)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.case.alerts(caseId ?? 'none') }),
  })
}

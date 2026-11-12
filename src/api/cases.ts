import { useQuery } from '@tanstack/react-query'
import { listCases } from '@/lib/session'
import { queryKeys } from '@/lib/queryKeys'

/**
 * This browser's conversations, and which one it is in.
 *
 * Also how the "You" pages learn which case they are about: the chat reports its case to the
 * screen around it, but a page of its own has no chat to ask, and a second `session start`
 * would race the first on a cold load and make a second case. The list is a read.
 */
export function useCases() {
  return useQuery({ queryKey: queryKeys.session.cases(), queryFn: () => listCases() })
}

/** The case this browser is in, once the list has answered. */
export function currentCaseId(
  cases:
    | { readonly cases: readonly { readonly caseId: string; readonly current: boolean }[] }
    | undefined,
): string | null {
  return cases?.cases.find((item) => item.current)?.caseId ?? null
}

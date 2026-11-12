import { useQuery } from '@tanstack/react-query'
import { ANONYMOUS, currentIdentity, type Identity } from '@/lib/identity'
import { queryKeys } from '@/lib/queryKeys'

/**
 * Who is signed in, as the browser knows it.
 *
 * Read rather than held in a store: it changes exactly once per visit, through a full page
 * redirect, so there is nothing to keep in step. Anonymous until the first answer arrives,
 * which is also what it will be for most visitors.
 */
export function useIdentity(): Identity {
  /*
   * A placeholder, not `initialData`: initial data counts as fresh for `staleTime`, so a page
   * that nothing else had asked on would have shown a silhouette to somebody signed in for
   * half a minute. The badge in the chat never noticed, because the prompts beside it asked
   * the same question without a stale time and filled the cache for it.
   */
  return (
    useQuery({
      queryKey: queryKeys.identity(),
      queryFn: () => currentIdentity(),
      placeholderData: ANONYMOUS,
      staleTime: 30_000,
    }).data ?? ANONYMOUS
  )
}

/** "CQ" for Chris Quinn; "?" when there is no name to take letters from. */
export function initialsOf(name: string | null): string {
  return (
    (name ?? '')
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

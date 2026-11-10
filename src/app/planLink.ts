/**
 * A saved comparison's link carries its token in the query, `?plan=<token>` (2026-11-10).
 *
 * Links used to put it in the hash, `#/plan/<token>`, and opened from claude.ai's card on a
 * phone the fragment never reached the app: it opened on a bare chat and the comparison was
 * lost. The query survives. This moves it into the app's own route and takes it out of the
 * address at once, so the token is not left in the history or sent on as a referrer
 * (Invariant 8). Runs before the router reads the location.
 */
export function routeForPlanLink(href: string): string | null {
  const url = new URL(href)
  const token = url.searchParams.get('plan')
  if (token === null || !/^[A-Za-z0-9_-]{22}$/.test(token)) return null
  url.searchParams.delete('plan')
  url.hash = `#/plan/${token}`
  return url.toString()
}

export function adoptPlanLink(win: Pick<Window, 'location' | 'history'>): void {
  const next = routeForPlanLink(win.location.href)
  if (next !== null) win.history.replaceState(null, '', next)
}

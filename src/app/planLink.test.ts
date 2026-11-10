import { describe, expect, it } from 'vitest'
import { adoptPlanLink, routeForPlanLink } from './planLink'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'

describe('a saved comparison link', () => {
  it('moves ?plan= into the app route and drops it from the query', () => {
    expect(routeForPlanLink(`https://app.saoi.ie/?plan=${TOKEN}`)).toBe(
      `https://app.saoi.ie/#/plan/${TOKEN}`,
    )
    expect(routeForPlanLink(`https://app.saoi.ie/?src=qr&plan=${TOKEN}#/`)).toBe(
      `https://app.saoi.ie/?src=qr#/plan/${TOKEN}`,
    )
  })

  it('leaves every other address alone, including the old #/plan/ links', () => {
    expect(routeForPlanLink(`https://app.saoi.ie/#/plan/${TOKEN}`)).toBeNull()
    expect(routeForPlanLink('https://app.saoi.ie/?plan=not-a-token')).toBeNull()
    expect(routeForPlanLink('https://app.saoi.ie/')).toBeNull()
  })

  it('replaces the address in place, so the token is not left in the history', () => {
    const calls: string[] = []
    adoptPlanLink({
      location: { href: `https://app.saoi.ie/?plan=${TOKEN}` } as Location,
      history: {
        replaceState: (_s: unknown, _t: string, url?: string | URL | null) => {
          calls.push(String(url))
        },
      } as unknown as History,
    })
    expect(calls).toEqual([`https://app.saoi.ie/#/plan/${TOKEN}`])
  })
})

import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Arriving from a comparison saved in the customer's own AI (2026-11-10): the `?plan=` link,
 * the welcome with the comparison, the data notice, then the claim and the chat. The API is
 * stubbed here, so it runs without the stack; against a deployment, use a fresh
 * `npm run plan:sample` link by hand instead.
 */

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'
const PREVIEW = {
  title: 'Buying a home by November 2028',
  figures: '€25k saved · €800/mo · €90k · €350k',
  comparison: {
    headline: 'At these figures, the deposit and buying costs are in place around July 2028.',
    sortedBy: '49 options that fit, sorted by cost over the first 5 years, lowest first.',
    filters: [],
    total: 49,
    options: [
      {
        lender: 'Bank of Ireland',
        kind: '4-year fixed',
        rate: '3.2%',
        monthly: '€1,362/mo',
        fiveYear: '€49,338 over 5 years',
        keys: 'July 2028',
        confirmed: true,
      },
      {
        lender: 'Avant Money',
        kind: '5-year fixed',
        rate: '3.7%',
        monthly: '€1,450/mo',
        fiveYear: '€49,385 over 5 years',
        keys: 'July 2028',
        confirmed: false,
      },
      {
        lender: 'Avant Money',
        kind: '4-year fixed',
        rate: '3.7%',
        monthly: '€1,450/mo',
        fiveYear: '€50,107 over 5 years',
        keys: 'July 2028',
        confirmed: false,
      },
    ],
  },
  products: [],
  expiresAt: '2026-11-11T12:00:00.000Z',
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
}

/** The API is another origin: answer the preflight, then the request, with CORS headers. */
const json = (route: Route, status: number, body: unknown) =>
  route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({
        status,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

async function stub(page: Page, preview: { status: number; body: unknown }): Promise<string[]> {
  const claims: string[] = []
  await page.route('**/api/plans/preview', (route) => json(route, preview.status, preview.body))
  await page.route('**/api/plans/claim', (route) => {
    if (route.request().method() === 'POST')
      claims.push(String((route.request().postDataJSON() as { token?: string } | null)?.token))
    return json(route, 409, { ok: false, error: { code: 'conflict', message: 'stubbed' } })
  })
  return claims
}

test('a ?plan= link welcomes with the comparison, shows the notice, then claims', async ({
  page,
}) => {
  const claims = await stub(page, { status: 200, body: PREVIEW })
  await page.goto(`/?plan=${TOKEN}`)
  await expect(page.getByRole('heading', { name: 'Welcome to Saoi' })).toBeVisible()
  // The token left the address straight away (Invariant 8).
  expect(page.url()).not.toContain('?plan=')
  await expect(page.getByText('€25k saved · €800/mo · €90k · €350k')).toBeVisible()
  await expect(page.getByText('46 more options come with it.')).toBeVisible()
  expect(claims).toEqual([])

  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Before you continue' })).toBeVisible()
  expect(claims).toEqual([])
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect.poll(() => claims).toEqual([TOKEN])
})

test('an expired link says so plainly, with a way to start again', async ({ page }) => {
  await stub(page, {
    status: 410,
    body: { ok: false, error: { code: 'expired', message: 'expired' } },
  })
  await page.goto(`/?plan=${TOKEN}`)
  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible()
  await expect(page.getByRole('link', { name: /start a fresh chat/i })).toBeVisible()
})

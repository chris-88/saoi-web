import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Arriving from a comparison saved in the customer's own AI (2026-11-12, build 1 of the
 * first-home experience): the `?plan=` link, the app's own card with what the host's card
 * showed, the grey notice box, Saoirse's one question, and nothing claimed until the customer
 * writes. The API is stubbed here, so it runs without the stack; against a deployment, use a
 * fresh `npm run plan:sample` link by hand instead.
 */

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'
const HOOK =
  'How much Income Tax and DIRT have you both paid over the last four years? It decides whether Help to Buy covers the €35,000.'

const route = (id: string, name: string, line: string) => ({
  id,
  name,
  mechanism: 'How the route works',
  status: 'potential',
  line,
  reason: 'Why it applies, or not.',
  missing: null,
  keysOn: null,
  conditions: [],
  confirmed: true,
  sources: [],
})

const PREVIEW = {
  title: 'Buying a home by November 2028',
  figures: '€32k saved · €1,500/mo · €110k · €400k',
  comparison: null,
  products: [],
  routes: [
    route(
      'new_build_help_to_buy',
      'New build with Help to Buy',
      'New build with Help to Buy: keys September 2027 if tax paid covers €35,000',
    ),
    route(
      'second_hand',
      'Second-hand',
      'Second-hand: €47,000 needed at the keys, not reached at this pace',
    ),
    route(
      'first_home_scheme',
      'First Home Scheme',
      'First Home Scheme: shared equity up to €80,000 (20% with Help to Buy) on a new build',
    ),
    route(
      'vacant_property_grant',
      'Vacant property grant',
      'Vacant property grant: up to €50,000 for works after purchase',
    ),
    route(
      'local_authority_home_loan',
      'Local Authority Home Loan',
      'Local Authority Home Loan: not at €110,000 joint income',
    ),
    route(
      'affordable_purchase',
      'Affordable purchase',
      'Affordable purchase: not at €110,000 for a €400,000 home',
    ),
  ],
  arrival: {
    keysOn: '2027-09',
    readyLine: 'September 2027',
    readyNote: null,
    factParts: ['€40,000 deposit', '+ €4,000 stamp duty', '+ €3,000 legal and survey'],
    progress: { savedEur: 32_000, neededEur: 47_000, monthlySavingEur: 1_500 },
    tiles: [
      {
        label: 'Savings',
        value: 'up to 3.25%',
        lines: ['€612 interest by Sep 2027', '7 accounts'],
      },
      {
        label: 'Mortgage',
        value: '€360,000',
        lines: ['from 3.45%, €1,607/mo', '41 options, 30 years'],
      },
      {
        label: 'Could afford',
        value: 'up to €488,000',
        lines: ['4× income, 90% loan', '30 years'],
      },
    ],
    assumptions: [
      'Assumed: a new build, first-time buyers. Estimates only; rates and offers are not confirmed.',
    ],
    hookQuestion: { key: 'tax_paid', question: HOOK, why: 'Help to Buy is conditional' },
  },
  opening: HOOK,
  expiresAt: '2026-11-13T12:00:00.000Z',
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
  // The claim needs an anonymous session; a stand-in one, so no user is made on any stack.
  await page.route('**/auth/v1/signup', (route) =>
    json(route, 200, {
      access_token: 'e2e-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'e2e-refresh-token',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        aud: 'authenticated',
        role: 'authenticated',
        is_anonymous: true,
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-11-12T10:00:00.000Z',
      },
    }),
  )
  await page.route('**/api/plans/preview', (route) => json(route, preview.status, preview.body))
  await page.route('**/api/plans/claim', (route) => {
    if (route.request().method() === 'POST')
      claims.push(String((route.request().postDataJSON() as { token?: string } | null)?.token))
    return json(route, 409, { ok: false, error: { code: 'conflict', message: 'stubbed' } })
  })
  return claims
}

test('a ?plan= link opens on the card, the notice box and one question; writing claims it', async ({
  page,
}) => {
  const claims = await stub(page, { status: 200, body: PREVIEW })
  await page.goto(`/?plan=${TOKEN}`)
  await expect(page.getByText('September 2027')).toBeVisible()
  // The token left the address straight away (Invariant 8), and there is no separate page.
  expect(page.url()).not.toContain('?plan=')
  await expect(page.getByText('up to €488,000')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Click here for the data protection notice' }),
  ).toBeVisible()
  await expect(page.getByText(HOOK)).toBeVisible()
  await expect(page.getByText(/Hi, I’m Saoirse/)).toHaveCount(0)
  await expect(page.getByText(/sent to Anthropic/)).toHaveCount(0)
  expect(claims).toEqual([])

  // Nothing scrolls sideways at 390px.
  const overflow = await page.evaluate<number>(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )
  expect(overflow).toBeLessThanOrEqual(0)
  // It opens on the top of the card, as the host showed it, then follows down to the question.
  await page.screenshot({ path: test.info().outputPath('arrival-390-landing.png') })
  await expect(page.getByText(HOOK)).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: test.info().outputPath('arrival-390-question.png') })

  const box = page.getByRole('textbox', { name: 'Message Saoirse' })
  await box.click()
  await box.pressSequentially('About €40,000 between us')
  await box.press('Enter')
  await expect.poll(() => claims).toEqual([TOKEN])
  // The stub says somebody else opened it: said in the chat, in view, under their message.
  await expect(page.getByText(/already been opened/)).toBeInViewport()
  await expect(page.getByText('About €40,000 between us')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('arrival-390-refused.png') })
})

test('an expired link is a message in the chat, with a chip to start again', async ({ page }) => {
  await stub(page, {
    status: 410,
    body: { ok: false, error: { code: 'expired', message: 'expired' } },
  })
  await page.goto(`/?plan=${TOKEN}`)
  await expect(page.getByText(/That link has expired/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible()
})

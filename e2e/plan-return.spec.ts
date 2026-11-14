import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * The card as the way back in (2026-11-14): the host's card keeps the plan link, so tapping it
 * after a break opens a plan that is already claimed. The preview refuses it (409); the arrival
 * tries the claim at once. The browser that opened it is back in its conversation; any other is
 * told the link was opened on another device and offered a sign-in. The API is stubbed.
 */

const TOKEN = 'ReTuRnToKeNaBcDeFgHiJk'
const CASE = '22222222-2222-4222-8222-222222222222'
const USER = '11111111-1111-4111-8111-111111111111'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const json = (route: Route, status: number, body: unknown) =>
  route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({
        status,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })

const SESSION = {
  caseId: CASE,
  participantId: '33333333-3333-4333-8333-333333333333',
  role: 'primary',
  authLevel: 'anonymous',
  customerFirstName: null,
  created: false,
  hasUpdates: false,
}

const USED = {
  ok: false,
  error: { code: 'conflict', message: 'Somebody has already opened this link.' },
}

type Calls = { claims: number; turns: number }

async function stub(page: Page, claim: { status: number; body: unknown }): Promise<Calls> {
  const calls: Calls = { claims: 0, turns: 0 }
  await page.route('**/auth/v1/signup', (route) =>
    json(route, 200, {
      access_token: 'e2e-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'e2e-refresh-token',
      user: {
        id: USER,
        aud: 'authenticated',
        role: 'authenticated',
        is_anonymous: true,
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-11-12T10:00:00.000Z',
      },
    }),
  )
  await page.route('**/api/plans/preview', (route) => json(route, 409, USED))
  await page.route('**/api/plans/claim', (route) => {
    if (route.request().method() === 'POST') calls.claims += 1
    return json(route, claim.status, claim.body)
  })
  await page.route('**/api/sessions', (route) => json(route, 200, SESSION))
  await page.route(/\/api\/cases$/, (route) => json(route, 200, { presenter: false, cases: [] }))
  await page.route(`**/api/cases/${CASE}/history`, (route) =>
    json(route, 200, {
      caseId: CASE,
      entries: [
        {
          kind: 'message',
          id: 'm1',
          author: 'assistant',
          text: 'What deposit have you saved so far?',
        },
        { kind: 'message', id: 'm2', author: 'customer', text: 'About €40,000 between us' },
        {
          kind: 'message',
          id: 'm3',
          author: 'assistant',
          text: 'That puts the keys in March 2028.',
        },
      ],
    }),
  )
  await page.route(`**/api/cases/${CASE}/holdings`, (route) =>
    json(route, 200, { holdings: [], progress: null }),
  )
  await page.route(`**/api/cases/${CASE}/plan`, (route) =>
    json(route, 404, { ok: false, error: { code: 'not_found', message: 'none' } }),
  )
  await page.route(`**/api/cases/${CASE}/turns`, (route) => {
    if (route.request().method() === 'POST') calls.turns += 1
    return json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } })
  })
  await page.route(`**/api/cases/${CASE}/feed**`, (route) =>
    json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } }),
  )
  return calls
}

test('the same browser taps the link again: straight back into its conversation', async ({
  page,
}) => {
  const calls = await stub(page, {
    status: 200,
    body: { ...SESSION, planTitle: 'Buying a home by November 2028', reopened: true },
  })
  await page.goto(`/?plan=${TOKEN}`)
  await expect(page.getByText('That puts the keys in March 2028.')).toBeVisible()
  await expect(page.getByText('About €40,000 between us')).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/')
  expect(calls.claims).toBe(1)
  // Nothing said on the way: no refusal, and no turn sent in their name.
  await expect(page.getByText(/opened on another device|already been opened/)).toHaveCount(0)
  expect(calls.turns).toBe(0)
  await page.screenshot({ path: test.info().outputPath('return-390-reopened.png') })
})

test('another device: the used-elsewhere state, with Sign in and Start again', async ({ page }) => {
  const calls = await stub(page, { status: 409, body: USED })
  await page.goto(`/?plan=${TOKEN}`)
  await expect(
    page.getByText(
      'This link was opened on another device. If you signed in to Saoi there, sign in here and your conversation is in your list.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible()
  expect(calls.claims).toBe(1)
  await page.screenshot({ path: test.info().outputPath('return-390-elsewhere.png') })

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('textbox', { name: 'Your email address' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('return-390-sign-in.png') })
  const overflow = await page.evaluate<number>(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

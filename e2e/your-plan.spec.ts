import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Your plan under You (2026-11-12, build 4 of the first-home experience): the row on You, the
 * plan page at 390px in light and dark, an edit in place, and the chat opening on Saoirse's
 * reading of it. The API is stubbed (the plan routes are not deployed yet), so it runs without
 * the stack.
 */

const CASE = '22222222-2222-4222-8222-222222222222'
const USER = '11111111-1111-4111-8111-111111111111'
const READING =
  'Saving €1,200 a month means €9,000 less saved by March 2028; the six-month deposits no longer fit.'

const PLAN = {
  planId: '44444444-4444-4444-8444-444444444444',
  title: 'A first home in Dublin',
  editable: {
    targetDate: '2028-03',
    homePrice: 400000,
    monthlySaving: 1500,
    propertyKind: 'second_hand',
    firstTimeBuyer: true,
    buyingTogether: true,
  },
  summary: {
    keysOn: '2028-03',
    neededAtKeysEur: 48000,
    savedEur: 32000,
    progressLine: 'At €1,500 a month the €48,000 is there by December 2027.',
  },
  watched: [
    {
      lead: 'Bank of Ireland',
      kind: 'instant access',
      value: '2.50%',
      figure: '€1,140 interest by March 2028',
    },
    {
      lead: 'AIB',
      kind: 'six-month fixed term deposit',
      value: '2.75%',
      figure: '€1,210 by March 2028',
    },
    { lead: 'PTSB', kind: 'regular saver', value: '3.00%', figure: '€1,380 by March 2028' },
  ],
  updatedAt: '2026-11-12T10:00:00.000Z',
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
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

async function stub(page: Page): Promise<unknown[]> {
  const patches: unknown[] = []
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
  await page.route(/\/api\/cases$/, (route) =>
    json(route, 200, {
      presenter: false,
      cases: [
        {
          caseId: CASE,
          label: null,
          opening: 'Saving for a house',
          messages: 4,
          applications: 0,
          lastActivityAt: '2026-11-12T09:00:00.000Z',
          current: true,
          mine: true,
        },
      ],
    }),
  )
  await page.route(`**/api/cases/${CASE}/plan`, (route) => {
    if (route.request().method() === 'PATCH') {
      patches.push(route.request().postDataJSON())
      return json(route, 200, { ...PLAN, updatedAt: '2026-11-12T11:00:00.000Z', reading: READING })
    }
    return json(route, 200, PLAN)
  })
  await page.route(`**/api/cases/${CASE}/holdings`, (route) =>
    json(route, 200, { holdings: [], progress: null }),
  )
  await page.route(`**/api/cases/${CASE}/snapshot`, (route) =>
    json(route, 200, {
      caseId: CASE,
      signedIn: false,
      applications: [],
      interests: [],
      plans: [],
      requests: [],
      formAnswers: [],
      reusedBy: {},
      linkedAccounts: [],
      transfers: [],
      notifications: [],
    }),
  )
  await page.route('**/api/sessions', (route) =>
    json(route, 200, {
      caseId: CASE,
      participantId: '33333333-3333-4333-8333-333333333333',
      role: 'primary',
      authLevel: 'anonymous',
      customerFirstName: null,
      created: false,
      hasUpdates: true,
    }),
  )
  await page.route(`**/api/cases/${CASE}/history`, (route) =>
    json(route, 200, {
      caseId: CASE,
      entries: [
        { kind: 'message', id: 'm1', author: 'customer', text: 'About €32,000 between us' },
      ],
    }),
  )
  // The return turn and the change feed are the server's; here they simply do not answer.
  await page.route(`**/api/cases/${CASE}/turns`, (route) =>
    json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } }),
  )
  await page.route(`**/api/cases/${CASE}/feed**`, (route) =>
    json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } }),
  )
  return patches
}

test('your plan: the row, the page at 390px, an edit, and the chat on the reading', async ({
  page,
}) => {
  const patches = await stub(page)

  await page.goto('/#/you')
  const row = page.getByRole('link', { name: /^Your plan/ })
  await expect(row).toContainText('Keys March 2028 · €32,000 of €48,000 saved')
  await page.screenshot({ path: test.info().outputPath('you-390.png'), fullPage: true })

  await row.click()
  await expect(page.getByText('A first home in Dublin')).toBeVisible()
  const overflow = await page.evaluate<number>(
    '(() => { const e = document.documentElement; return e.scrollWidth - e.clientWidth })()',
  )
  expect(overflow).toBe(0)
  await page.screenshot({ path: test.info().outputPath('plan-390.png'), fullPage: true })
  await page.evaluate('document.documentElement.classList.add("dark")')
  // Rows ease their colours (`transition-colors`); let them land before the picture.
  await page.waitForTimeout(300)
  await page.screenshot({ path: test.info().outputPath('plan-390-dark.png'), fullPage: true })
  await page.evaluate('document.documentElement.classList.remove("dark")')

  // The segmented control fits the column: its last option ends inside the form.
  await page.getByRole('button', { name: /^Kind of home/ }).click()
  const last = await page.getByRole('radio', { name: 'Self-build' }).boundingBox()
  const form = await page.locator('form').boundingBox()
  expect((last?.x ?? 0) + (last?.width ?? 0)).toBeLessThanOrEqual(
    (form?.x ?? 0) + (form?.width ?? 0) + 0.5,
  )
  // And no option's label is cut.
  const cut = await page.evaluate<number>(
    '[...document.querySelectorAll("[role=radio]")].filter((e) => e.scrollWidth > e.clientWidth).length',
  )
  expect(cut).toBe(0)
  await page.screenshot({ path: test.info().outputPath('plan-390-kind.png') })
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Keyboard only: focus the row, open it, type, save.
  await page.getByRole('button', { name: /^Saved each month/ }).focus()
  await page.keyboard.press('Enter')
  const input = page.getByLabel('Saved each month (€)')
  await expect(input).toBeFocused()
  await input.fill('1,200')
  await page.screenshot({ path: test.info().outputPath('plan-390-editing.png') })
  await page.keyboard.press('Enter')

  await expect(page.getByText(READING)).toBeVisible()
  expect(page.url()).toMatch(/#\/$/)
  expect(patches).toEqual([{ monthlySaving: 1200 }])
  // Nothing was said in the customer's name.
  await expect(page.getByText('1,200', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('chat-390-reading.png') })
})

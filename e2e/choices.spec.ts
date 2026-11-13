import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

/**
 * Choosing products for the plan (Chris, 2026-11-13: "get the customer to pick products from
 * the product lists we're presenting"): one row selected, "Choose for…" on the bar, the sheet
 * with the plan's slots in their figures, the POST, the badge on the row, the plan card's
 * "Your choices", and Your plan's section with Change and Remove, at 390px in light and dark.
 * The API is stubbed (the choices routes are not deployed yet), so it runs without the stack.
 * CHOICES_SHOTS_DIR copies the screenshots out.
 */

const CASE = '22222222-2222-4222-8222-222222222222'
const USER = '11111111-1111-4111-8111-111111111111'
const STATEMENT =
  'Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares products on the figures you give.'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const row = (fields: {
  id: string
  lead: string
  kind: string
  value: string
  figure: string
  providerId: string
  brand: { bg: string; fg: string }
}) => ({ ...fields, note: null, held: false, confirmed: true })

const BUNQ = row({
  id: 'bunq:easy-savings',
  lead: 'bunq Easy Savings',
  kind: 'instant access',
  value: '3.11% to 1 Jan',
  figure: '€581 by Mar 2028',
  providerId: 'bunq',
  brand: { bg: '#1f7a4d', fg: '#fff' },
})
const SUPERSAVER = row({
  id: 'boi:supersaver',
  lead: 'Bank of Ireland SuperSaver',
  kind: 'regular saver',
  value: '3.00%',
  figure: '€702 by Mar 2028',
  providerId: 'boi',
  brand: { bg: '#0b2a6f', fg: '#fff' },
})
const FIXED = row({
  id: 'boi:fixed-18',
  lead: 'Bank of Ireland Fixed Term Deposit',
  kind: '18-month fixed',
  value: '2.50%',
  figure: '€1,190 by Mar 2028',
  providerId: 'boi',
  brand: { bg: '#0b2a6f', fg: '#fff' },
})

const productsCard = {
  type: 'market_products',
  question: 'Where could the monthly saving go?',
  arrangement: {
    kind: 'by_access',
    title: 'Instant access against fixed term',
    line: 'By access, instant first. Ask for them by rate or by the date instead.',
    groups: [
      { label: 'Instant access', rowIds: [BUNQ.id, SUPERSAVER.id] },
      { label: 'Fixed term', rowIds: [FIXED.id] },
    ],
  },
  rows: [BUNQ, SUPERSAVER, FIXED],
  more: 0,
  basis: {
    figures: ['€32,000 saved', '€1,000 a month'],
    objective: 'By access, instant first.',
    assumptions: ['Rates stay as published until March 2028', 'DIRT at 33%'],
    coverage: '31 savings and deposit accounts, checked 12 Nov 2026',
    warnings: [],
  },
  statement: STATEMENT,
}

const savedPlanCard = {
  type: 'saved_plan',
  planId: '44444444-4444-4444-8444-444444444444',
  title: 'A first home in Dublin',
  summary: 'Has €32,000 saved and puts €1,000 aside a month.',
  goals: [{ label: 'House deposit', target: '€48,000 by March 2028' }],
  products: [],
  debts: [],
  basis: 'Ranked by cost over the first 5 years.',
  assumptions: [],
  attributions: [],
  routes: [],
  createdAt: '2026-11-12T10:00:00Z',
  dataCheckedAt: '2026-11-12T10:00:00Z',
  arrival: {
    keysOn: '2028-03',
    readyLine: 'March 2028',
    readyNote: 'Before interest',
    factParts: ['€40,000 deposit', '+ €5,000 stamp duty', '+ €3,000 legal and survey'],
    progress: { savedEur: 32_000, neededEur: 48_000, monthlySavingEur: 1_000 },
    tiles: [
      {
        label: 'Savings',
        qualifier: 'up to',
        value: '3.11%',
        sub: ['€815 interest', 'by Mar 2028'],
        quiet: ['28 accounts'],
        detail: [],
        lines: [],
      },
      {
        label: 'Mortgage',
        qualifier: 'from',
        value: '€1,751/mo',
        sub: ['€360,000 loan', 'from 3.20%'],
        quiet: ['49 options'],
        detail: [],
        lines: [],
      },
      {
        label: 'Could afford',
        qualifier: 'up to',
        value: '€420,000',
        sub: ['4× income', '90% loan'],
        quiet: [],
        detail: [],
        lines: [],
      },
    ],
    assumptions: ['Assumed: first-time buyers. Estimates only.'],
    hookQuestion: null,
  },
}

type Slot = 'lump_sum' | 'monthly_saving' | 'mortgage'
type Choice = Record<string, unknown> | null

function planWith(choices: Record<Slot, Choice>) {
  return {
    planId: '44444444-4444-4444-8444-444444444444',
    title: 'A first home in Dublin',
    editable: {
      targetDate: '2028-03',
      homePrice: 400000,
      monthlySaving: 1000,
      propertyKind: 'second_hand',
      firstTimeBuyer: true,
      buyingTogether: true,
    },
    summary: { keysOn: '2028-03', neededAtKeysEur: 48000, savedEur: 32000, progressLine: null },
    watched: [],
    updatedAt: '2026-11-12T10:00:00.000Z',
    choices,
  }
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

type Calls = { posts: unknown[]; deletes: string[]; turns: number }

async function stub(page: Page): Promise<Calls> {
  const calls: Calls = { posts: [], deletes: [], turns: 0 }
  const choices: Record<Slot, Choice> = {
    lump_sum: {
      slot: 'lump_sum',
      rowId: FIXED.id,
      lead: FIXED.lead,
      providerId: 'boi',
      kind: FIXED.kind,
      value: FIXED.value,
      figure: FIXED.figure,
      chosenAt: '2026-11-13T09:00:00.000Z',
    },
    monthly_saving: null,
    mortgage: null,
  }
  const rows = [BUNQ, SUPERSAVER, FIXED]

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
  await page.route(`**/api/cases/${CASE}/plan`, (route) => json(route, 200, planWith(choices)))
  await page.route(`**/api/cases/${CASE}/plan/choices`, (route) => {
    if (route.request().method() !== 'POST') return json(route, 204, null)
    const body = route.request().postDataJSON() as { slot: Slot; rowId: string }
    calls.posts.push(body)
    const chosen = rows.find((candidate) => candidate.id === body.rowId)
    if (chosen === undefined) {
      return json(route, 400, { ok: false, error: { code: 'bad', message: 'No such product.' } })
    }
    choices[body.slot] = {
      slot: body.slot,
      rowId: chosen.id,
      lead: chosen.lead,
      providerId: chosen.providerId,
      kind: chosen.kind,
      value: chosen.value,
      figure: chosen.figure,
      chosenAt: '2026-11-13T10:00:00.000Z',
    }
    return json(route, 200, planWith(choices))
  })
  await page.route(`**/api/cases/${CASE}/plan/choices/*`, (route) => {
    if (route.request().method() !== 'DELETE') return json(route, 204, null)
    const slot = route.request().url().split('/').pop() as Slot
    calls.deletes.push(slot)
    choices[slot] = null
    return json(route, 200, planWith(choices))
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
      hasUpdates: false,
    }),
  )
  await page.route(`**/api/cases/${CASE}/history`, (route) =>
    json(route, 200, {
      caseId: CASE,
      entries: [
        { kind: 'card', id: 'c0', card: savedPlanCard },
        { kind: 'message', id: 'm1', author: 'customer', text: 'Where could the €1,000 go?' },
        { kind: 'message', id: 'm2', author: 'assistant', text: 'Side by side, by access.' },
        { kind: 'card', id: 'c1', card: productsCard },
      ],
    }),
  )
  await page.route(`**/api/cases/${CASE}/turns`, (route) => {
    calls.turns += 1
    return json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } })
  })
  await page.route(`**/api/cases/${CASE}/feed**`, (route) =>
    json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } }),
  )
  await page.route(`**/api/cases/${CASE}/feedback**`, (route) => json(route, 200, { ok: true }))
  return calls
}

const sideways = (page: Page) =>
  page.evaluate<number>(
    '(() => { const e = document.documentElement; return e.scrollWidth - e.clientWidth })()',
  )

const SHOTS = process.env.CHOICES_SHOTS_DIR

async function shot(target: Page | Locator, page: Page, name: string): Promise<void> {
  await page.waitForTimeout(350)
  await target.screenshot({ path: test.info().outputPath(name) })
  if (SHOTS !== undefined) await target.screenshot({ path: `${SHOTS}/${name}` })
}

/** The same picture with `.dark` on the root, then back to light. */
async function darkShot(target: Page | Locator, page: Page, name: string): Promise<void> {
  await page.evaluate('document.documentElement.classList.add("dark")')
  await shot(target, page, name)
  await page.evaluate('document.documentElement.classList.remove("dark")')
}

test('choose one product for the plan from the cards, and see it chosen, at 390px', async ({
  page,
}) => {
  const calls = await stub(page)
  await page.goto('/#/')
  await expect(
    page.getByRole('heading', { name: 'Instant access against fixed term' }),
  ).toBeVisible()

  // The fixed term is already the lump sum's choice: badged on the row.
  const fixed = page.getByRole('checkbox', { name: /^Bank of Ireland Fixed Term Deposit/ })
  await expect(fixed).toContainText('your €32,000')

  // One selected: "Choose for…" beside Compare.
  await page.getByRole('checkbox', { name: /^bunq Easy Savings/ }).click()
  const chooseFor = page.getByRole('button', { name: 'Choose for…' })
  await expect(chooseFor).toBeVisible()
  expect(await sideways(page)).toBe(0)

  await shot(page, page, 'compare-bar-choose-390.png')

  // From the keyboard: Enter opens the sheet.
  await chooseFor.focus()
  await page.keyboard.press('Enter')
  const sheet = page.getByRole('dialog', { name: 'Choose for your plan' })
  await expect(sheet.getByRole('button', { name: 'My €1,000 a month' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^My €32,000/ })).toContainText(
    'Now: Bank of Ireland Fixed Term Deposit',
  )
  for (const slot of await sheet.getByRole('list').getByRole('button').all()) {
    expect((await slot.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
  await shot(page, page, 'choose-sheet-390.png')
  await darkShot(page, page, 'choose-sheet-390-dark.png')

  // Replacing the lump sum's choice asks first.
  await sheet.getByRole('button', { name: /^My €32,000/ }).click()
  await expect(sheet.getByRole('group', { name: 'Replace the choice' })).toContainText(
    'Replace Bank of Ireland Fixed Term Deposit with bunq Easy Savings?',
  )
  await shot(page, page, 'choose-sheet-replace-390.png')
  await sheet.getByRole('button', { name: 'Keep it' }).click()
  expect(calls.posts).toEqual([])

  // An open slot commits on the tap.
  await sheet.getByRole('button', { name: 'My €1,000 a month' }).click()
  await expect(sheet).toHaveCount(0)
  expect(calls.posts).toEqual([{ slot: 'monthly_saving', rowId: 'bunq:easy-savings' }])
  // The selection cleared, and nothing was said from the client.
  await expect(page.getByRole('group', { name: 'Selected to compare' })).toHaveCount(0)
  expect(calls.turns).toBe(0)

  const bunq = page.getByRole('checkbox', { name: /^bunq Easy Savings/ })
  await expect(bunq).toContainText('your monthly saving')
  await expect(bunq).toHaveAttribute('aria-checked', 'false')
  const products = page.locator('[data-slot="card"]').filter({
    has: page.getByRole('heading', { name: 'Instant access against fixed term' }),
  })
  await products.scrollIntoViewIfNeeded()
  await shot(products, page, 'badged-row-390.png')
  await darkShot(products, page, 'badged-row-390-dark.png')

  // The plan card in the chat: its choices under the figures.
  const block = page.getByRole('region', { name: 'Your choices' })
  await expect(block).toContainText('bunq Easy Savings')
  await expect(block).toContainText('Your mortgage')
  await expect(block).toContainText('not chosen yet')
  const planCard = page.locator('[data-slot="card"]').filter({ has: block })
  await planCard.scrollIntoViewIfNeeded()
  await shot(planCard, page, 'plan-card-choices-390.png')
  await darkShot(planCard, page, 'plan-card-choices-390-dark.png')
  expect(await sideways(page)).toBe(0)
})

test('your plan lists the choices, removes one, and changes one in the chat', async ({ page }) => {
  const calls = await stub(page)
  await page.goto('/#/you/plan')
  const section = page.getByRole('list', { name: 'Your choices' })
  await expect(section).toContainText('Bank of Ireland Fixed Term Deposit')
  await expect(section).toContainText('€1,190 by Mar 2028')
  await expect(section).toContainText('Not chosen yet')
  expect(await sideways(page)).toBe(0)

  // The group with its label: the innermost block holding both.
  const group = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Your choices' }) })
    .last()
  await section.scrollIntoViewIfNeeded()
  await shot(group, page, 'your-plan-choices-390.png')
  await darkShot(group, page, 'your-plan-choices-390-dark.png')

  await page
    .getByRole('button', { name: 'Remove Bank of Ireland Fixed Term Deposit from your €32,000' })
    .click()
  await expect(section).not.toContainText('Bank of Ireland Fixed Term Deposit')
  expect(calls.deletes).toEqual(['lump_sum'])

  await page.getByRole('button', { name: 'See options for your €1,000 a month' }).click()
  await expect(page.getByRole('textbox', { name: 'Message Saoirse' })).toHaveText(
    'Show me the options for my monthly saving',
  )
  expect(page.url()).toMatch(/#\/$/)
  expect(calls.turns).toBe(0)
  await shot(page, page, 'chat-composer-prefilled-390.png')
})

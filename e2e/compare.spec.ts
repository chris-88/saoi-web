import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Selecting products on the cards and comparing them (Chris, 2026-11-13): rows ticked on two
 * products cards, the bar above the composer, Compare sending "Compare these" with the selection
 * on the turn, the comparison card that answers it, all at 390px. The API is stubbed (the
 * backend's `compare_products` is not deployed yet), so it runs without the stack.
 */

/** What the overflow check reads off an element (the e2e project has no DOM lib). */
type Overflowing = { scrollWidth: number; clientWidth: number }

const CASE = '22222222-2222-4222-8222-222222222222'
const USER = '11111111-1111-4111-8111-111111111111'
const STATEMENT =
  'Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares products on the figures you give.'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
}

const BASIS = {
  figures: ['€25,000 saved', '€800 a month'],
  objective: 'By access, instant first.',
  assumptions: ['Rates stay as published until July 2028', 'DIRT at 33%'],
  coverage: '31 savings and deposit accounts, checked 12 Nov 2026',
  warnings: [],
}

type Row = {
  id: string
  lead: string
  kind: string
  value: string
  figure: string
  providerId: string
  brand: { bg: string; fg: string } | null
  mustKnow: string[]
  detail: string[]
}

const row = (fields: Row) => ({ ...fields, note: null, held: false, confirmed: true })

const BUNQ = row({
  id: 'bunq:easy-savings',
  lead: 'bunq Easy Savings',
  kind: 'instant access',
  value: '3.11% to 1 Jan',
  figure: '€581 by Jul 2028',
  providerId: 'bunq',
  brand: { bg: '#1f7a4d', fg: '#fff' },
  mustKnow: ['Rate ends 1 Jan, then 1.61%', 'Deposit guarantee: Netherlands, not Ireland'],
  detail: ['From bunq’s own site, checked 12 Nov 2026'],
})
const SUPERSAVER = row({
  id: 'boi:supersaver',
  lead: 'Bank of Ireland SuperSaver',
  kind: 'regular saver',
  value: '3.00%',
  figure: '€702 by Jul 2028',
  providerId: 'boi',
  brand: { bg: '#0b2a6f', fg: '#fff' },
  mustKnow: ['Monthly saving €100 to €1,000'],
  detail: ['From the bank’s own site, checked 12 Nov 2026'],
})
const MOCO = row({
  id: 'moco:easysaver',
  lead: 'MoCo EasySaver',
  kind: 'instant access',
  value: '2.10%',
  figure: '€420 by Jul 2028',
  providerId: 'moco',
  brand: { bg: '#14284b', fg: '#fff' },
  mustKnow: ['Rate for new accounts; how long it holds is not stated'],
  detail: [],
})
const FIXED = row({
  id: 'boi:fixed-18',
  lead: 'Bank of Ireland Fixed Term Deposit',
  kind: '18-month fixed',
  value: '2.50%',
  figure: '€702 by Jul 2028',
  providerId: 'boi',
  brand: { bg: '#0b2a6f', fg: '#fff' },
  mustKnow: ['Money locked for 18 months'],
  detail: [],
})

const ROWS = [BUNQ, SUPERSAVER, MOCO, FIXED]

const firstCard = {
  type: 'market_products',
  question: 'What does the market pay?',
  arrangement: {
    kind: 'held_vs_market',
    title: 'Instant access accounts',
    line: 'By rate. Ask for them by access or by the date instead.',
  },
  rows: [BUNQ, MOCO],
  more: 0,
  basis: BASIS,
  statement: STATEMENT,
}

const secondCard = {
  type: 'market_products',
  question: 'How soon can I get at the money?',
  arrangement: {
    kind: 'by_access',
    title: 'Instant access against fixed term',
    line: 'By access, instant first. Ask for them by rate or by the date instead.',
    groups: [
      { label: 'Instant access', rowIds: [BUNQ.id, SUPERSAVER.id, MOCO.id] },
      { label: 'Fixed term', rowIds: [FIXED.id] },
    ],
  },
  rows: ROWS,
  more: 3,
  basis: BASIS,
  statement: STATEMENT,
}

/** What `compare_products` would send for the products selected, in their order. */
function comparisonFor(selection: readonly { rowId: string }[]) {
  const columns = selection.map((item) => ROWS.find((candidate) => candidate.id === item.rowId)!)
  const values = (pick: (r: (typeof ROWS)[number]) => string) => columns.map(pick)
  return {
    type: 'product_comparison',
    title: columns.map((column) => column.lead).join(' and '),
    columns: columns.map((column) => ({
      rowId: column.id,
      lead: column.lead,
      providerId: column.providerId,
      brand: column.brand,
      kind: column.kind,
    })),
    rows: [
      { label: 'Rate', values: values((r) => r.value), differs: true },
      {
        label: 'By Jul 2028',
        values: values((r) => r.figure.replace(' by Jul 2028', '')),
        differs: true,
      },
      {
        label: 'Access',
        values: values((r) => r.kind),
        differs: columns.some((c) => c.kind !== columns[0]!.kind),
      },
      {
        label: 'Deposit guarantee',
        values: values((r) =>
          r.providerId === 'bunq' ? 'Netherlands, €100,000' : 'Ireland, €100,000',
        ),
        differs: true,
      },
      { label: 'Tax', values: values(() => 'DIRT at 33%'), differs: false },
    ],
    differences: [
      'SuperSaver takes €100 to €1,000 a month; bunq takes any amount.',
      'bunq’s rate drops on 1 Jan; SuperSaver’s holds for a year.',
    ],
    decides: 'Will you save more than €1,000 a month?',
    mustKnow: columns.map((column) => ({
      rowId: column.id,
      facts: column.mustKnow,
      detail: column.detail,
    })),
    basis: {
      figures: BASIS.figures,
      assumptions: BASIS.assumptions,
      coverage: 'The products selected, checked 12 Nov 2026',
      warnings: ['Rates can change.'],
    },
    statement: STATEMENT,
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

async function stub(page: Page): Promise<unknown[]> {
  const turns: unknown[] = []
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
        { kind: 'message', id: 'm1', author: 'customer', text: 'What does the market pay?' },
        { kind: 'message', id: 'm2', author: 'assistant', text: 'Instant access, by rate.' },
        { kind: 'card', id: 'c1', card: firstCard },
        { kind: 'message', id: 'm3', author: 'customer', text: 'And against fixed term?' },
        { kind: 'message', id: 'm4', author: 'assistant', text: 'Side by side, by access.' },
        { kind: 'card', id: 'c2', card: secondCard },
      ],
    }),
  )
  await page.route(`**/api/cases/${CASE}/turns`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const body = route.request().postDataJSON() as { selection?: { rowId: string }[] }
    turns.push(body)
    const events = [
      { type: 'text_delta', text: 'Here they are side by side.' },
      { type: 'card', card: comparisonFor(body.selection ?? []) },
      {
        type: 'done',
        messageId: '55555555-5555-4555-8555-555555555555',
        gateCategory: 'banking',
      },
    ]
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'text/event-stream' },
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
    })
  })
  await page.route(`**/api/cases/${CASE}/feed**`, (route) =>
    json(route, 503, { ok: false, error: { code: 'stub', message: 'stubbed' } }),
  )
  await page.route(`**/api/cases/${CASE}/feedback**`, (route) => json(route, 200, { ok: true }))
  return turns
}

const sideways = (page: Page) =>
  page.evaluate<number>(
    '(() => { const e = document.documentElement; return e.scrollWidth - e.clientWidth })()',
  )

const SHOTS = process.env.COMPARE_SHOTS_DIR

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: test.info().outputPath(name) })
  if (SHOTS !== undefined) await page.screenshot({ path: `${SHOTS}/${name}` })
}

/**
 * The comparison card whole: taller than the phone's screen, so the window is made taller (still
 * 390 wide) for the picture, and put back.
 */
async function cardShot(page: Page, name: string): Promise<void> {
  const size = page.viewportSize()
  await page.setViewportSize({ width: 390, height: 1800 })
  const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole('table') })
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await card.screenshot({ path: test.info().outputPath(name) })
  if (SHOTS !== undefined) await card.screenshot({ path: `${SHOTS}/${name}` })
  if (size !== null) await page.setViewportSize(size)
}

test('select two on the cards, compare them, and read the comparison at 390px', async ({
  page,
}) => {
  const turns = await stub(page)
  await page.goto('/#/')

  await expect(
    page.getByRole('heading', { name: 'Instant access against fixed term' }),
  ).toBeVisible()
  const bar = page.getByRole('group', { name: 'Selected to compare' })
  await expect(bar).toHaveCount(0)

  // bunq on the first card ticks it on the second too; SuperSaver from the second.
  await page
    .getByRole('checkbox', { name: /^bunq Easy Savings/ })
    .first()
    .click()
  await expect(bar).toContainText('1 selected')
  await expect(page.getByRole('button', { name: 'Compare' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /^Bank of Ireland SuperSaver/ }).click()

  const bunqBoxes = page.getByRole('checkbox', { name: /^bunq Easy Savings/ })
  await expect(bunqBoxes.nth(0)).toHaveAttribute('aria-checked', 'true')
  await expect(bunqBoxes.nth(1)).toHaveAttribute('aria-checked', 'true')
  await expect(bar).toContainText('bunq Easy Savings · Bank of Ireland SuperSaver')
  expect(await sideways(page)).toBe(0)
  await page.waitForTimeout(250)
  await shot(page, 'products-two-selected-390.png')

  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByRole('heading', { name: 'What differs' })).toBeVisible()
  expect(turns).toEqual([
    {
      trigger: 'message',
      message: 'Compare these',
      selection: [
        { rowId: 'bunq:easy-savings', lead: 'bunq Easy Savings' },
        { rowId: 'boi:supersaver', lead: 'Bank of Ireland SuperSaver' },
      ],
    },
  ])
  await expect(page.getByText('Compare these', { exact: true })).toBeVisible()
  // The reply came, so the selection is spent.
  await expect(bar).toHaveCount(0)
  await expect(bunqBoxes.nth(0)).toHaveAttribute('aria-checked', 'false')
  expect(await sideways(page)).toBe(0)

  await cardShot(page, 'comparison-two-390.png')
  await page.getByRole('button', { name: 'What to know about each' }).click()
  await page.getByRole('button', { name: 'How this was worked out' }).last().click()
  await cardShot(page, 'comparison-two-open-390.png')
})

test('three selected scroll sideways inside the card, never the page; a fourth is refused', async ({
  page,
}) => {
  const turns = await stub(page)
  await page.goto('/#/')
  await expect(
    page.getByRole('heading', { name: 'Instant access against fixed term' }),
  ).toBeVisible()

  await page
    .getByRole('checkbox', { name: /^bunq Easy Savings/ })
    .last()
    .click()
  await page.getByRole('checkbox', { name: /^Bank of Ireland SuperSaver/ }).click()
  await page
    .getByRole('checkbox', { name: /^MoCo EasySaver/ })
    .last()
    .click()
  // From the keyboard: focus the fourth and press Space.
  await page.getByRole('checkbox', { name: /^Bank of Ireland Fixed Term Deposit/ }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Up to three to compare. Untick one to add another.')).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: /^Bank of Ireland Fixed Term Deposit/ }),
  ).toHaveAttribute('aria-checked', 'false')

  // A typed message carries the selection too.
  const composer = page.getByRole('textbox', { name: 'Message Saoirse' })
  await composer.click()
  await page.keyboard.type('Which of these lets me take money out?')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'What differs' })).toBeVisible()
  expect(turns).toHaveLength(1)
  expect((turns[0] as { selection: unknown[] }).selection).toHaveLength(3)

  expect(await sideways(page)).toBe(0)
  const scroller = page.getByRole('region', { name: /, table$/ })
  const overflow = await scroller.evaluate(
    (element: Overflowing) => element.scrollWidth - element.clientWidth,
  )
  expect(overflow).toBeGreaterThan(0)

  await cardShot(page, 'comparison-three-390.png')
})

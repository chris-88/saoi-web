import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { cardSchema, type MarketProductsCard as Payload } from '@contracts/cards.ts'
import { MarketProductsCard } from './MarketProductsCard'

/**
 * Fixtures in the server's conventions (`domain/market/products-card.ts` in `chris-88/saoi`):
 * held rows are `held:<n>` and led "Your …"; savings kinds are lower case ("instant access",
 * "6-month fixed"); a mortgage row's kind carries the rate, its value is "€…/mo" and its figure
 * the five-year cost, with the keys month in front under the keys-date sort.
 */
const statement =
  'Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares products on the figures you give.'

const savingsBasis: Payload['basis'] = {
  figures: ['€25,000 saved', '€800 a month'],
  objective: 'Interest after DIRT by July 2028, highest first. Ask for them by access instead.',
  assumptions: ['Rates stay as published until July 2028', 'DIRT at 33%'],
  coverage:
    '31 savings and deposit accounts from CCPC and the providers’ own sites, checked 12 Nov 2026',
  warnings: [],
}

/** Their own account, sent second here, shown first by the card. */
const heldVsMarket: Payload = {
  type: 'market_products',
  question: 'What does my savings account earn against the market?',
  arrangement: {
    kind: 'held_vs_market',
    title: 'Your account against the market',
    line: 'Arranged by rate, your own account first. Ask for them by access, or by the date, instead.',
  },
  rows: [
    {
      id: 'bunq:easy-savings',
      lead: 'bunq Easy Savings',
      kind: 'instant access',
      value: '2.51%',
      figure: '€1,402 by Jul 2028',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'held:0',
      lead: 'Your BoI savings',
      kind: 'instant access',
      value: '0.10%',
      figure: '€56 by Jul 2028',
      note: 'your rate as you gave it',
      held: true,
      confirmed: true,
    },
    {
      id: 'moco:instant',
      lead: 'MoCo Instant Access',
      kind: 'instant access',
      value: '2.25%',
      figure: '€1,257 by Jul 2028',
      note: 'rate from CCPC only',
      held: false,
      confirmed: false,
    },
  ],
  more: 4,
  basis: savingsBasis,
  statement,
}

const byAccess: Payload = {
  type: 'market_products',
  question: 'How soon can I get at the money?',
  arrangement: {
    kind: 'by_access',
    title: 'Instant access against fixed term',
    line: 'Arranged by access, the rate difference stated as the price of access. Ask for them by rate, or by the date, instead.',
  },
  rows: [
    {
      id: 'bunq:easy-savings',
      lead: 'bunq Easy Savings',
      kind: 'instant access',
      value: '2.51%',
      figure: '€421 in a year',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'ptsb:notice-31',
      lead: 'PTSB Notice Account',
      kind: '31-day notice',
      value: '2.60%',
      figure: '€436 in a year',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'ptsb:fixed-12',
      lead: 'PTSB Fixed Term',
      kind: '1-year fixed',
      value: '2.80%',
      figure: '€469 in a year',
      note: '0.29 points more than instant access, for a year locked',
      held: false,
      confirmed: true,
    },
  ],
  more: 0,
  basis: savingsBasis,
  statement,
}

const fitsDate: Payload = {
  type: 'market_products',
  question: 'Where can the deposit sit until the keys in July 2028?',
  arrangement: {
    kind: 'fits_date',
    title: 'Accounts that fit July 2028',
    line: 'Arranged by the term that fits July 2028: six-month terms, then accounts you can take the money from, each by what it adds by then. Ask for them by access, or against your own account, instead.',
  },
  rows: [
    {
      id: 'boi:fixed-6',
      lead: 'Bank of Ireland Fixed Term',
      kind: '6-month fixed',
      value: '2.40%',
      figure: '€201 by Jul 2028',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'aib:online-saver',
      lead: 'AIB Online Saver',
      kind: 'instant access',
      value: '2.00%',
      figure: '€1,118 by Jul 2028',
      note: 'bonus paid after drawdown, not counted',
      held: false,
      confirmed: true,
    },
  ],
  more: 1,
  basis: savingsBasis,
  statement,
}

const mortgageBySort: Payload = {
  type: 'market_products',
  question: 'What would the mortgage cost?',
  arrangement: {
    kind: 'mortgage_by_sort',
    title: 'Mortgage options at 90% loan-to-value',
    line: 'Arranged by keys date, as you chose. Ask for them by 5-year cost, or by monthly repayment, instead.',
  },
  rows: [
    {
      id: 'avant:fixed-4',
      lead: 'Avant Money',
      kind: '4-year fixed at 3.25%',
      value: '€1,567/mo',
      figure: 'keys Jul 2028, €58,612 over 5 years',
      note: null,
      held: false,
      confirmed: true,
    },
    {
      id: 'aib:green-3',
      lead: 'AIB',
      kind: '3-year fixed at 3.45%',
      value: '€1,612/mo',
      figure: 'keys Jul 2028, €60,118 over 5 years',
      note: 'cashback from CCPC only',
      held: false,
      confirmed: false,
    },
  ],
  more: 9,
  basis: {
    figures: ['a €400,000 home, €360,000 borrowed (90% of the price)', 'over 30 years'],
    objective:
      'The month the keys are in reach, soonest first. Ask for them by 5-year cost instead.',
    assumptions: ['First-time buyer', 'The rate after the fixed period is today’s variable'],
    coverage: '11 lenders from CCPC and the lenders’ own sites, checked 12 Nov 2026',
    warnings: [
      'Warning: if you do not keep up your repayments you may lose your home.',
      'Warning: the cost of your monthly repayments may increase.',
      'Warning: if you do not meet the repayments on your loan, your account will go into arrears.',
    ],
  },
  statement,
}

/**
 * The new shape (2026-11-13): rows with the provider, its colours, the facts to know and the
 * rest; the arrangement line one short sentence, the comparison moved into the basis. The four
 * rows of Chris's screenshot.
 */
const keyFacts: Payload = {
  type: 'market_products',
  question: 'How soon can I get at the money?',
  arrangement: {
    kind: 'by_access',
    title: 'Instant access against fixed term',
    line: 'By access, instant first. Ask for them by rate or by the date instead.',
  },
  rows: [
    {
      id: 'bunq:easy-savings',
      lead: 'bunq Easy Savings',
      kind: 'instant access',
      value: '3.11% to 1 Jan',
      figure: '€581 by Jul 2028',
      note: 'then 1.61% to €10,000 and 1.51% above; the money counts both',
      held: false,
      confirmed: true,
      providerId: 'bunq',
      brand: { bg: '#1f7a4d', fg: '#fff' },
      mustKnow: ['Rate ends 1 Jan, then 1.61%', 'Deposit guarantee: Netherlands, not Ireland'],
      detail: [
        'Then 1.61% to €10,000 and 1.51% above; the figure counts both',
        'From bunq’s own site, checked 12 Nov 2026',
      ],
    },
    {
      id: 'moco:instant',
      lead: 'MoCo Instant Access',
      kind: 'instant access',
      value: '2.25%',
      figure: '€420 by Jul 2028',
      note: 'rate from CCPC only; how long it holds is not stated',
      held: false,
      confirmed: false,
      providerId: 'moco',
      brand: { bg: '#14284b', fg: '#fff' },
      mustKnow: ['How long the rate holds is not stated'],
      detail: ['Rate from CCPC only, checked 12 Nov 2026; not on MoCo’s own site'],
    },
    {
      id: 'state-savings:deposit',
      lead: 'State Savings Deposit Account',
      kind: 'instant access',
      value: '0.65%',
      figure: '€121 by Jul 2028',
      note: null,
      held: false,
      confirmed: true,
      providerId: 'state-savings',
      brand: null,
      mustKnow: [],
      detail: [],
    },
    {
      id: 'boi:fixed-18',
      lead: 'Bank of Ireland Fixed Term Deposit',
      kind: '18-month fixed',
      value: '2.50%',
      figure: '€702 by Jul 2028',
      note: 'money locked until May 2028',
      held: false,
      confirmed: true,
      providerId: 'boi',
      brand: { bg: '#0b2a6f', fg: '#fff' },
      mustKnow: ['Money locked for 18 months'],
      detail: ['No withdrawals before May 2028', 'From the bank’s own site, checked 12 Nov 2026'],
    },
  ],
  more: 3,
  basis: {
    ...savingsBasis,
    objective:
      'By access, instant first; the price of access is 0.39 points between bunq and 18 months fixed.',
  },
  statement,
}

/** The same rows by type (2026-11-13): instant access, then fixed term. */
const grouped: Payload = {
  ...keyFacts,
  arrangement: {
    ...keyFacts.arrangement,
    groups: [
      {
        label: 'Instant access',
        rowIds: ['bunq:easy-savings', 'moco:instant', 'state-savings:deposit'],
      },
      { label: 'Fixed term', rowIds: ['boi:fixed-18'] },
    ],
  },
}

const fixtures = [heldVsMarket, byAccess, fitsDate, mortgageBySort, keyFacts] as const

describe('MarketProductsCard', () => {
  it('parses every fixture against the contract', () => {
    for (const fixture of fixtures) {
      expect(cardSchema.parse(fixture)).toEqual(fixture)
    }
  })

  it.each(fixtures.map((card) => [card.arrangement.kind, card] as const))(
    'names its arrangement (%s) and how to change it, and closes with the statement',
    (_kind, card) => {
      render(<MarketProductsCard card={card} />)
      expect(screen.getByRole('heading', { name: card.arrangement.title })).toBeInTheDocument()
      expect(screen.getByText(card.arrangement.line)).toBeInTheDocument()
      expect(screen.getByText(statement)).toBeInTheDocument()
      const list = screen.getByRole('list', { name: card.arrangement.title })
      const items = within(list).getAllByRole('listitem')
      expect(items).toHaveLength(card.rows.length)
      for (const row of card.rows) {
        const item = items.find((candidate) => candidate.textContent.includes(row.lead))
        expect(item).toBeDefined()
        expect(item).toHaveTextContent(row.value)
        expect(item).toHaveTextContent(row.figure)
        expect(item).toHaveTextContent(row.kind)
      }
      // Nothing on the card is a pick: the controls only open detail (the fold, and each row
      // with something to open).
      const openable = card.rows.filter(
        (row) =>
          (row.mustKnow?.length ?? 0) > 0 ||
          (row.detail === undefined ? row.note !== null : row.detail.length > 0),
      )
      expect(screen.getAllByRole('button')).toHaveLength(1 + openable.length)
    },
  )

  it('puts their own account first, marked as theirs', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    const items = within(
      screen.getByRole('list', { name: heldVsMarket.arrangement.title }),
    ).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Your BoI savings')
    expect(within(items[0]!).getByText('yours')).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('bunq Easy Savings')
    expect(screen.getAllByText('yours')).toHaveLength(1)
    expect(screen.getByText('your rate as you gave it')).not.toBeVisible()
  })

  it('sets instant access, notice and fixed term side by side, each with its kind', () => {
    render(<MarketProductsCard card={byAccess} />)
    expect(screen.getByText(/instant access$/)).toBeInTheDocument()
    expect(screen.getByText(/31-day notice$/)).toBeInTheDocument()
    expect(screen.getByText(/1-year fixed$/)).toBeInTheDocument()
    expect(screen.queryByText('yours')).not.toBeInTheDocument()
  })

  it('shows the accounts that fit the date with what they add by then', () => {
    render(<MarketProductsCard card={fitsDate} />)
    expect(screen.getByText(/6-month fixed$/)).toBeInTheDocument()
    expect(screen.getByText('€201 by Jul 2028')).toBeInTheDocument()
    expect(screen.getByText('bonus paid after drawdown, not counted')).not.toBeVisible()
    expect(screen.getByText('1 more; ask to see it')).toBeInTheDocument()
  })

  it('lists lender rows with their monthly repayment and five-year cost', () => {
    render(<MarketProductsCard card={mortgageBySort} />)
    expect(screen.getByText('€1,567/mo')).toBeInTheDocument()
    expect(screen.getByText('€1,612/mo')).toBeInTheDocument()
    expect(screen.getByText(/4-year fixed at 3\.25%$/)).toBeInTheDocument()
    expect(screen.getByText('keys Jul 2028, €58,612 over 5 years')).toBeInTheDocument()
  })

  it('says how many more there are, as something to ask for', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    expect(screen.getByText('4 more; ask to see them')).toBeInTheDocument()
  })

  it('says nothing about more when there are none', () => {
    render(<MarketProductsCard card={byAccess} />)
    expect(screen.queryByText(/more; ask to see/)).not.toBeInTheDocument()
  })

  it('marks an unconfirmed row and says what the mark means', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    expect(screen.getAllByLabelText('not confirmed')).toHaveLength(1)
    expect(screen.getByText(/^\* From CCPC only/)).toBeInTheDocument()
  })

  it('has no mark and no footnote when every row is confirmed', () => {
    render(<MarketProductsCard card={byAccess} />)
    expect(screen.queryByLabelText('not confirmed')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\* From CCPC only/)).not.toBeInTheDocument()
  })

  it('folds the basis behind one line that opens and closes', () => {
    render(<MarketProductsCard card={mortgageBySort} />)
    const fold = screen.getByRole('button', { name: 'How this was worked out' })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(mortgageBySort.basis.coverage)).not.toBeVisible()

    fireEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'How this was worked out' })
    expect(fold).toHaveAttribute('aria-controls', panel.id)
    for (const line of [
      ...mortgageBySort.basis.figures,
      mortgageBySort.basis.objective,
      ...mortgageBySort.basis.assumptions,
      mortgageBySort.basis.coverage,
      ...mortgageBySort.basis.warnings,
    ]) {
      expect(within(panel).getByText(line)).toBeVisible()
    }

    fireEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'false')
  })

  it('leaves out the warnings heading when there are none', () => {
    render(<MarketProductsCard card={heldVsMarket} />)
    fireEvent.click(screen.getByRole('button', { name: 'How this was worked out' }))
    expect(screen.queryByText('Warnings')).not.toBeInTheDocument()
    expect(screen.getByText('Assumed')).toBeInTheDocument()
  })

  it('says so when no product matches', () => {
    render(<MarketProductsCard card={{ ...byAccess, rows: [], more: 0 }} />)
    expect(screen.getByText('Nothing in the market matches this.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: byAccess.arrangement.title })).not.toBeInTheDocument()
  })

  describe('rows as key facts', () => {
    const rowButton = (lead: string): HTMLElement =>
      screen.getByRole('button', { name: new RegExp(`^${lead}`) })

    it('shows only the key facts on a closed row', () => {
      render(<MarketProductsCard card={keyFacts} />)
      const bunq = within(
        screen.getByRole('list', { name: keyFacts.arrangement.title }),
      ).getAllByRole('listitem')[0]!
      expect(within(bunq).getByText('bunq Easy Savings')).toBeVisible()
      expect(within(bunq).getByText('bunq Easy Savings')).toHaveAttribute(
        'title',
        'bunq Easy Savings',
      )
      expect(within(bunq).getByText('instant access')).toBeVisible()
      expect(within(bunq).getByText('€581 by Jul 2028')).toBeVisible()
      expect(within(bunq).getByText('B')).toBeVisible()
      // The facts wait for a tap; the old note is not shown at all.
      for (const line of [...keyFacts.rows[0]!.mustKnow!, ...keyFacts.rows[0]!.detail!]) {
        expect(within(bunq).getByText(line)).not.toBeVisible()
      }
      expect(screen.queryByText(keyFacts.rows[0]!.note!)).not.toBeInTheDocument()
      expect(rowButton('bunq Easy Savings')).toHaveAttribute('aria-expanded', 'false')
    })

    it('splits the value from its period', () => {
      render(<MarketProductsCard card={keyFacts} />)
      expect(screen.getByText('3.11%')).toBeVisible()
      expect(screen.getByText('to 1 Jan')).toBeVisible()
      expect(screen.queryByText('3.11% to 1 Jan')).not.toBeInTheDocument()
      expect(screen.getByText('2.25%')).toBeVisible()
    })

    it('opens a row to what to know first, then the rest, one row at a time', () => {
      render(<MarketProductsCard card={keyFacts} />)
      const bunq = rowButton('bunq Easy Savings')
      fireEvent.click(bunq)
      expect(bunq).toHaveAttribute('aria-expanded', 'true')
      const panel = screen.getByRole('region', { name: 'About bunq Easy Savings' })
      expect(bunq).toHaveAttribute('aria-controls', panel.id)
      const first = within(panel).getByText('Rate ends 1 Jan, then 1.61%')
      const rest = within(panel).getByText('From bunq’s own site, checked 12 Nov 2026')
      expect(first).toBeVisible()
      expect(rest).toBeVisible()
      expect(within(panel).getAllByRole('listitem')).toHaveLength(2)
      expect(first.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

      const boi = rowButton('Bank of Ireland Fixed Term Deposit')
      fireEvent.click(boi)
      expect(boi).toHaveAttribute('aria-expanded', 'true')
      expect(bunq).toHaveAttribute('aria-expanded', 'false')
      expect(within(panel).getByText('Rate ends 1 Jan, then 1.61%')).not.toBeVisible()
      expect(screen.getByText('Money locked for 18 months')).toBeVisible()

      fireEvent.click(boi)
      expect(boi).toHaveAttribute('aria-expanded', 'false')
    })

    it('has no control on a row with nothing to open', () => {
      render(<MarketProductsCard card={keyFacts} />)
      expect(screen.getAllByRole('button')).toHaveLength(4)
      expect(screen.getByText('State Savings Deposit Account').closest('button')).toBeNull()
      expect(screen.getByText('SS')).toBeVisible()
    })

    it('opens and closes from the keyboard', () => {
      render(<MarketProductsCard card={keyFacts} />)
      const moco = rowButton('MoCo Instant Access')
      // A native button: Tab reaches it, Enter and Space press it.
      expect(moco.tagName).toBe('BUTTON')
      moco.focus()
      expect(moco).toHaveFocus()
      fireEvent.click(moco)
      expect(moco).toHaveAttribute('aria-expanded', 'true')
      fireEvent.keyDown(moco, { key: 'Escape' })
      expect(moco).toHaveAttribute('aria-expanded', 'false')
      expect(moco).toHaveFocus()
    })

    it('keeps the unconfirmed marker and the footnote', () => {
      render(<MarketProductsCard card={keyFacts} />)
      expect(within(rowButton('MoCo Instant Access')).getByLabelText('not confirmed')).toBeVisible()
      expect(screen.getByText(/^\* From CCPC only/)).toBeInTheDocument()
    })

    it('keeps the comparison in the fold, with the basis', () => {
      render(<MarketProductsCard card={keyFacts} />)
      expect(screen.getByText(keyFacts.basis.objective)).not.toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'How this was worked out' }))
      expect(screen.getByText(keyFacts.basis.objective)).toBeVisible()
    })

    it('opens a card saved before key facts to its note', () => {
      render(<MarketProductsCard card={heldVsMarket} />)
      // Their own account has a note, so it opens to it; bunq has none, so it has no control.
      fireEvent.click(rowButton('Your BoI savings'))
      expect(screen.getByText('your rate as you gave it')).toBeVisible()
      expect(screen.getByText('bunq Easy Savings').closest('button')).toBeNull()
      // A neutral monogram from the lead when there is no provider.
      expect(screen.getByText('BoI')).toBeVisible()
    })
  })

  describe('rows by type', () => {
    const labelsInOrder = (): string[] =>
      screen.getAllByText(/^(Instant access|Fixed term)$/).map((element) => element.textContent)

    it('shows each group under its label, in the groups’ order', () => {
      render(<MarketProductsCard card={grouped} />)
      expect(cardSchema.parse(grouped)).toEqual(grouped)
      expect(labelsInOrder()).toEqual(['Instant access', 'Fixed term'])
      const instant = within(screen.getByRole('list', { name: 'Instant access' })).getAllByRole(
        'listitem',
      )
      expect(instant.map((item) => item.textContent)).toEqual([
        expect.stringContaining('bunq Easy Savings'),
        expect.stringContaining('MoCo Instant Access'),
        expect.stringContaining('State Savings Deposit Account'),
      ])
      const fixed = within(screen.getByRole('list', { name: 'Fixed term' })).getAllByRole(
        'listitem',
      )
      expect(fixed).toHaveLength(1)
      expect(fixed[0]).toHaveTextContent('Bank of Ireland Fixed Term Deposit')
      // Grouped, there is no one list for the whole card.
      expect(screen.queryByRole('list', { name: grouped.arrangement.title })).toBeNull()
    })

    it('puts a row in no group after the groups, under no label', () => {
      const card: Payload = {
        ...grouped,
        arrangement: {
          ...grouped.arrangement,
          groups: [
            { label: 'Instant access', rowIds: ['bunq:easy-savings', 'moco:instant'] },
            { label: 'Fixed term', rowIds: ['boi:fixed-18'] },
          ],
        },
      }
      render(<MarketProductsCard card={card} />)
      const lists = screen.getAllByRole('list').filter((list) => list.tagName === 'OL')
      expect(lists).toHaveLength(3)
      const rest = lists[2]!
      expect(rest).not.toHaveAccessibleName()
      expect(within(rest).getAllByRole('listitem')).toHaveLength(1)
      expect(rest).toHaveTextContent('State Savings Deposit Account')
      expect(labelsInOrder()).toEqual(['Instant access', 'Fixed term'])
    })

    it('opens one row at a time across groups', () => {
      render(<MarketProductsCard card={grouped} />)
      const bunq = screen.getByRole('button', { name: /^bunq Easy Savings/ })
      const boi = screen.getByRole('button', { name: /^Bank of Ireland Fixed Term Deposit/ })
      fireEvent.click(bunq)
      fireEvent.click(boi)
      expect(bunq).toHaveAttribute('aria-expanded', 'false')
      expect(boi).toHaveAttribute('aria-expanded', 'true')
    })

    it('shows one list, without labels, when there are no groups', () => {
      render(<MarketProductsCard card={keyFacts} />)
      expect(screen.queryByText('Instant access')).toBeNull()
      expect(screen.queryByText('Fixed term')).toBeNull()
      const list = screen.getByRole('list', { name: keyFacts.arrangement.title })
      expect(within(list).getAllByRole('listitem')).toHaveLength(keyFacts.rows.length)
    })
  })
})

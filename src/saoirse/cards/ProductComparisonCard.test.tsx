import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { cardSchema, type ProductComparisonCard as Payload } from '@contracts/cards.ts'
import { ProductComparisonCard } from './ProductComparisonCard'

const statement =
  'Saoi is not regulated by the Central Bank of Ireland and does not give advice; it compares products on the figures you give.'

/** Two savings accounts, in the order the customer selected them. */
const twoColumns: Payload = {
  type: 'product_comparison',
  title: 'bunq Easy Savings and Bank of Ireland SuperSaver',
  columns: [
    {
      rowId: 'bunq:easy-savings',
      lead: 'bunq Easy Savings',
      providerId: 'bunq',
      brand: { bg: '#1f7a4d', fg: '#fff' },
      kind: 'instant access',
    },
    {
      rowId: 'boi:supersaver',
      lead: 'Bank of Ireland SuperSaver',
      providerId: 'boi',
      brand: { bg: '#0b2a6f', fg: '#fff' },
      kind: 'regular saver',
    },
  ],
  rows: [
    { label: 'Rate', values: ['3.11% to 1 Jan, then 1.61%', '3.00%'], differs: true },
    { label: 'By Jul 2028', values: ['€581', '€702'], differs: true },
    { label: 'Access', values: ['instant', 'instant'], differs: false },
    { label: 'Monthly saving', values: ['any amount', '€100 to €1,000'], differs: true },
  ],
  differences: [
    'SuperSaver takes €100 to €1,000 a month; bunq takes any amount.',
    'bunq’s rate drops on 1 Jan; SuperSaver’s holds for a year.',
  ],
  decides: 'Will you save more than €1,000 a month?',
  mustKnow: [
    {
      rowId: 'boi:supersaver',
      facts: ['Monthly saving €100 to €1,000'],
      detail: ['From the bank’s own site, checked 12 Nov 2026'],
    },
    {
      rowId: 'bunq:easy-savings',
      facts: ['Rate ends 1 Jan, then 1.61%', 'Deposit guarantee: Netherlands, not Ireland'],
      detail: ['From bunq’s own site, checked 12 Nov 2026'],
    },
  ],
  basis: {
    figures: ['€25,000 saved', '€800 a month'],
    assumptions: ['Rates stay as published until July 2028'],
    coverage: 'The two products selected, checked 12 Nov 2026',
    warnings: ['Rates can change.'],
  },
  statement,
}

/** Three, one with no brand on record and no must-knows. */
const threeColumns: Payload = {
  ...twoColumns,
  title: 'Three accounts side by side',
  columns: [
    ...twoColumns.columns,
    {
      rowId: 'state-savings:deposit',
      lead: 'State Savings Deposit Account',
      kind: 'instant access',
    },
  ],
  rows: [
    { label: 'Rate', values: ['3.11% to 1 Jan', '3.00%', '0.65%'], differs: true },
    { label: 'Access', values: ['instant', 'instant', 'instant'], differs: false },
  ],
}

describe('ProductComparisonCard', () => {
  it('parses both fixtures against the contract', () => {
    expect(cardSchema.parse(twoColumns)).toEqual(twoColumns)
    expect(cardSchema.parse(threeColumns)).toEqual(threeColumns)
  })

  it('refuses one column or four', () => {
    expect(() => cardSchema.parse({ ...twoColumns, columns: [twoColumns.columns[0]] })).toThrow()
    expect(() =>
      cardSchema.parse({
        ...threeColumns,
        columns: [...threeColumns.columns, { rowId: 'x', lead: 'X', kind: 'k' }],
      }),
    ).toThrow()
  })

  it('heads a column per product, in the selection order, with monogram, lead and kind', () => {
    render(<ProductComparisonCard card={twoColumns} />)
    expect(screen.getByRole('heading', { name: twoColumns.title })).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveTextContent('bunq Easy Savings')
    expect(headers[0]).toHaveTextContent('instant access')
    expect(within(headers[0]!).getByText('B')).toBeInTheDocument()
    expect(headers[1]).toHaveTextContent('Bank of Ireland SuperSaver')
    expect(headers[1]).toHaveTextContent('regular saver')
    expect(within(headers[1]!).getByText('BoI')).toBeInTheDocument()
  })

  it('sets a row per fact, a value per product, what differs in normal text and the rest quiet', () => {
    render(<ProductComparisonCard card={twoColumns} />)
    const rate = screen.getByRole('row', { name: /^Rate/ })
    expect(within(rate).getByRole('rowheader')).toHaveTextContent('Rate')
    const cells = within(rate).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual(['3.11% to 1 Jan, then 1.61%', '3.00%'])
    for (const cell of cells) expect(cell).toHaveClass('text-foreground')

    const access = screen.getByRole('row', { name: /^Access/ })
    for (const cell of within(access).getAllByRole('cell'))
      expect(cell).toHaveClass('text-muted-foreground')
  })

  it('lists what differs, then asks the one question that decides', () => {
    render(<ProductComparisonCard card={twoColumns} />)
    expect(screen.getByRole('heading', { name: 'What differs' })).toBeInTheDocument()
    for (const line of twoColumns.differences) expect(screen.getByText(line)).toBeVisible()
    const question = screen.getByText(twoColumns.decides)
    expect(question).toHaveClass('font-medium')
    expect(screen.getByText(twoColumns.differences[1]!).compareDocumentPosition(question)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('folds what to know about each, in the columns’ order, with each one’s detail', () => {
    render(<ProductComparisonCard card={twoColumns} />)
    const fold = screen.getByRole('button', { name: 'What to know about each' })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Monthly saving €100 to €1,000')).not.toBeVisible()

    fireEvent.click(fold)
    const panel = screen.getByRole('region', { name: 'What to know about each' })
    const bunq = within(panel).getByText('bunq Easy Savings')
    const boi = within(panel).getByText('Bank of Ireland SuperSaver')
    // bunq was selected first, so it comes first, whatever order the server listed them in.
    expect(bunq.compareDocumentPosition(boi)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    for (const line of [
      'Rate ends 1 Jan, then 1.61%',
      'Deposit guarantee: Netherlands, not Ireland',
      'From bunq’s own site, checked 12 Nov 2026',
      'Monthly saving €100 to €1,000',
      'From the bank’s own site, checked 12 Nov 2026',
    ]) {
      expect(within(panel).getByText(line)).toBeVisible()
    }
  })

  it('folds the basis with its warnings', () => {
    render(<ProductComparisonCard card={twoColumns} />)
    expect(screen.getByText('Rates can change.')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'How this was worked out' }))
    const panel = screen.getByRole('region', { name: 'How this was worked out' })
    for (const line of [
      ...twoColumns.basis.figures,
      ...twoColumns.basis.assumptions,
      twoColumns.basis.coverage,
      ...twoColumns.basis.warnings,
    ]) {
      expect(within(panel).getByText(line)).toBeVisible()
    }
    expect(screen.getByText(statement)).toBeInTheDocument()
  })

  it('fits two columns without a scroller', () => {
    render(<ProductComparisonCard card={twoColumns} />)
    expect(screen.getByRole('table')).not.toHaveClass('min-w-104')
    expect(screen.queryByRole('region', { name: /, table$/ })).toBeNull()
  })

  it('scrolls three columns inside the card, reachable from the keyboard', () => {
    render(<ProductComparisonCard card={threeColumns} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    const scroller = screen.getByRole('region', { name: `${threeColumns.title}, table` })
    expect(scroller).toHaveClass('overflow-x-auto')
    expect(scroller).toHaveAttribute('tabindex', '0')
    expect(within(scroller).getByRole('table')).toHaveClass('min-w-104')
    // A neutral monogram when no brand is on record.
    expect(within(screen.getAllByRole('columnheader')[2]!).getByText('S')).toBeInTheDocument()
  })

  it('leaves out the must-knows fold when there are none, and marks nothing as a pick', () => {
    render(<ProductComparisonCard card={{ ...twoColumns, mustKnow: [] }} />)
    expect(screen.queryByRole('button', { name: 'What to know about each' })).toBeNull()
    // The only controls are the folds: nothing to choose on the card itself.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Privacy } from './Privacy'

describe('the privacy page', () => {
  it('says how long reminders and plan alerts are kept', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(
        'Reminders you set and alerts about your plan are kept on your case until you delete them or the case is deleted.',
      ),
    ).toBeInTheDocument()
  })

  it('says what is recorded when an AI calls Saoi', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(
        'When an AI calls Saoi, Saoi records which assistant, which tool, the figures in bands and any search words, and the time; no name, address or account.',
      ),
    ).toBeInTheDocument()
  })

  it('says how long balances and debts are kept', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    )
    expect(
      screen.getByText('Balances and debts you enter are kept on your case until you delete them.'),
    ).toBeInTheDocument()
  })

  it('says what signing in with Google hands over', () => {
    render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(
        'If you sign in with Google, Saoi receives the name and email address on that account and nothing else.',
      ),
    ).toBeInTheDocument()
  })
})

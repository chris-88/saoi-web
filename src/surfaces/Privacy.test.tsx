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
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GOOGLE_NOTICE_LINE } from '@/lib/planArrival'
import { NOTICE } from '@/lib/planClaim'
import type * as IdentityModule from '@/lib/identity'

const identity = vi.hoisted(() => ({
  available: true,
  startGoogleSignIn: vi.fn<() => Promise<{ ok: boolean; message?: string }>>(),
  lastSignInError: vi.fn<() => string | null>(),
}))

vi.mock('@/lib/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof IdentityModule>()),
  googleSignInAvailable: () => identity.available,
  startGoogleSignIn: () => identity.startGoogleSignIn(),
  lastSignInError: () => identity.lastSignInError(),
}))

const { SignInForm } = await import('./SignInForm')

beforeEach(() => {
  identity.available = true
  identity.startGoogleSignIn.mockReset()
  identity.lastSignInError.mockReturnValue(null)
})

describe('SignInForm', () => {
  it('offers Google above the email field', () => {
    render(<SignInForm />)

    const google = screen.getByRole('button', { name: 'Continue with Google' })
    const email = screen.getByRole('textbox', { name: 'Your email address' })
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('shows it is on the way to Google while the browser leaves', async () => {
    identity.startGoogleSignIn.mockReturnValue(new Promise(() => undefined))
    render(<SignInForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(await screen.findByRole('button', { name: 'Opening Google…' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Your email address' })).toBeDisabled()
  })

  it('says why when Google could not be started, and lets them try again', async () => {
    identity.startGoogleSignIn.mockResolvedValue({ ok: false, message: 'provider disabled' })
    render(<SignInForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(await screen.findByText('provider disabled')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled(),
    )
  })

  it('shows the reason a Google return failed, left by completeSignIn', () => {
    identity.lastSignInError.mockReturnValue('The user denied access')
    render(<SignInForm />)
    expect(screen.getByText('The user denied access')).toBeInTheDocument()
  })

  it('draws no Google button when there is no backend to sign in with', () => {
    identity.available = false
    render(<SignInForm />)
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
    expect(screen.queryByText('or')).toBeNull()
  })
})

describe('the data notice', () => {
  it('says what signing in with Google hands over', () => {
    expect(GOOGLE_NOTICE_LINE).toBe(
      'If you sign in with Google, Saoi receives the name and email address on that account and nothing else.',
    )
    expect(NOTICE.lines).toContain(GOOGLE_NOTICE_LINE)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  linkIdentity: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
}))

const session = vi.hoisted(() => ({
  rememberPriorUser: vi.fn(),
  claimPriorConversation: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth },
  requireSupabase: () => ({ auth }),
}))
vi.mock('@/lib/session', () => session)

const { completeSignIn, lastKnownAddress, lastSignInError, startGoogleSignIn, takeSignedInMoment } =
  await import('@/lib/identity')

const ANON = { id: 'anon-1', is_anonymous: true, email: undefined }

/** Puts the browser where GoTrue would send it back to. */
function arriveAt(url: string): void {
  window.history.replaceState(null, '', url)
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  arriveAt('/#/')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  auth.linkIdentity.mockResolvedValue({ data: {}, error: null })
  auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
  session.claimPriorConversation.mockResolvedValue(null)
})

describe('startGoogleSignIn', () => {
  it('links Google to the anonymous visitor, keeping the user and the conversation', async () => {
    auth.getUser.mockResolvedValue({ data: { user: ANON } })

    expect(await startGoogleSignIn()).toEqual({ ok: true })

    expect(session.rememberPriorUser).toHaveBeenCalledWith('anon-1')
    expect(auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    expect(auth.signInWithOAuth).not.toHaveBeenCalled()
  })

  it('signs in with Google when there is no anonymous visitor to link to', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } })

    expect(await startGoogleSignIn()).toEqual({ ok: true })

    expect(auth.linkIdentity).not.toHaveBeenCalled()
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  })

  it('falls back to signing in when the link is refused before leaving', async () => {
    auth.getUser.mockResolvedValue({ data: { user: ANON } })
    auth.linkIdentity.mockResolvedValue({
      data: {},
      error: { message: 'Manual linking is disabled' },
    })

    expect(await startGoogleSignIn()).toEqual({ ok: true })
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1)
  })

  it('reports a failure to start rather than spinning', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } })
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'provider disabled' } })

    expect(await startGoogleSignIn()).toEqual({ ok: false, message: 'provider disabled' })
  })
})

describe('completeSignIn after Google', () => {
  const REFUSED =
    '/?error=invalid_request&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user'

  it('turns a refused link into one plain Google sign-in, and never a second', async () => {
    auth.getUser.mockResolvedValue({ data: { user: ANON } })
    window.location.hash = '#/plan'
    await startGoogleSignIn()

    arriveAt(REFUSED)
    expect(await completeSignIn()).toEqual({ signedIn: false })
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    // The refusal is out of the address bar.
    expect(window.location.search).toBe('')

    // Refused again: no loop. The reason is left for the form and they land where they were.
    arriveAt(REFUSED)
    const second = await completeSignIn()
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(second.signedIn).toBe(false)
    expect(lastSignInError()).toBe('Identity is already linked to another user')
    expect(window.location.hash).toBe('#/plan')
  })

  it('recognises the refusal by its description when there is no code', async () => {
    arriveAt('/?error=server_error&error_description=Identity+is+already+linked+to+another+user')
    await completeSignIn()
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1)
  })

  it('does not retry a refusal that is not a taken identity', async () => {
    arriveAt('/?error=access_denied&error_description=The+user+denied+access')
    const result = await completeSignIn()
    expect(auth.signInWithOAuth).not.toHaveBeenCalled()
    expect(result).toEqual({ signedIn: false, error: 'The user denied access' })
    expect(lastSignInError()).toBe('The user denied access')
  })

  it('notes the moment and the address, and claims the conversation, on a good return', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'anon-1', is_anonymous: false, email: 'aoife@example.ie' } },
    })
    arriveAt('/?code=abc123')

    expect(await completeSignIn()).toEqual({ signedIn: true })

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    expect(session.claimPriorConversation).toHaveBeenCalledTimes(1)
    expect(lastKnownAddress()).toBe('aoife@example.ie')
    expect(takeSignedInMoment()).toBe(true)
    expect(window.location.search).toBe('')
  })

  it('clears the retry bound on a good return, so a later refusal gets its one retry', async () => {
    arriveAt('/?error_code=identity_already_exists')
    await completeSignIn()
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1)

    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u-2', is_anonymous: false } } })
    arriveAt('/?code=xyz')
    await completeSignIn()

    arriveAt('/?error_code=identity_already_exists')
    await completeSignIn()
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(2)
  })
})

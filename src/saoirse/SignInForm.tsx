import { useEffect, useState, type ReactNode } from 'react'
import { MailIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AnimatePresence, m } from 'motion/react'
import { fade, useStill } from '@/lib/motion'
import { useSignInSignal } from '@/saoirse/signInSignal'
import {
  clearSignInError,
  forgetKnownAddress,
  googleSignInAvailable,
  lastSignInError,
  maskedAddress,
  startEmailSignIn,
  startGoogleSignIn,
  verifyEmailCode,
} from '@/lib/identity'

/**
 * Address, then code. The whole of signing in to Saoirse.
 *
 * Shared by the card Saoirse offers mid-conversation and by the menu, because they are the same
 * two steps and a second copy of them is a second thing to get wrong: the length of the code,
 * the order of the code and the link, and what happens on success all have to match, and the
 * last time two sign-in paths drifted apart one of them stopped working for a week.
 *
 * Google first, then the address. Google links to the visitor already here, so the
 * conversation is still there on the way back; the email code is for everybody else.
 */

/**
 * Google's "G", the four-colour mark on a white disc, as its branding guidance asks for.
 * Decorative: the button says what it does.
 */
function GoogleMark(): ReactNode {
  return (
    <svg
      className="size-[18px]"
      width="18"
      height="18"
      viewBox="-3 -3 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="9" r="12" fill="#fff" />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

/**
 * How many digits the field will take.
 *
 * Supabase allows six to ten and the project is pushed to six, so six is what the copy says.
 * The range is here rather than a single number because the authority for the real length is
 * the hosted auth config, which this bundle cannot read: accepting the range means a config
 * that drifts produces a rejected code with a reason, rather than a code silently cut short.
 */
const MIN_CODE = 6
const MAX_CODE = 10

export function SignInForm({
  disabled,
  knownAddress,
}: {
  disabled?: boolean
  /**
   * The address this browser signed in with before, if it has.
   *
   * Turns the first step into one tap on a masked address instead of typing it again, with a
   * way out: a demo device gets handed around, and "not me" has to be reachable without
   * signing in as the previous person first.
   */
  knownAddress?: string
}): ReactNode {
  const [busy, setBusy] = useState(false)
  /** Set from the tap until the browser leaves for Google; cleared if it never does. */
  const [redirecting, setRedirecting] = useState(false)
  const markSignedIn = useSignInSignal((signal) => signal.markSignedIn)
  const still = useStill()

  /*
   * A sign-in that failed on the way back has nowhere else to appear.
   *
   * `completeSignIn` runs before React mounts, so it leaves the reason behind, and this is on
   * screen afterwards. Read as the initial value rather than in an effect: an effect that sets
   * state on mount is a cascading render, and the read is deliberately non-destructive so
   * StrictMode's second pass does not swallow the message. It is cleared when they try again.
   */
  const [error, setError] = useState<string | null>(() => lastSignInError())

  const [email, setEmail] = useState(knownAddress ?? '')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')

  /** Dropped when they say it is not them, or when they ask to type a different one. */
  const [known, setKnown] = useState<string | null>(knownAddress ?? null)

  const notMe = () => {
    forgetKnownAddress()
    setKnown(null)
    setEmail('')
  }

  const enterCode = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    void verifyEmailCode(email, code).then((result) => {
      setBusy(false)
      if (result.ok) {
        /*
         * The session is live. The conversation is told rather than the page reloaded: it
         * refreshes the identity, re-runs the session so the server attaches the address,
         * settles this card in place and has Saoirse pick up. A reload did all of that by force,
         * with a white flash and three things popping into place.
         */
        markSignedIn()
        return
      }
      setError(result.message ?? 'That did not work.')
    })
  }

  const sendCode = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    clearSignInError()
    void startEmailSignIn(email).then((result) => {
      setBusy(false)
      if (result.ok) setSent(true)
      else setError(result.message ?? 'That did not work.')
    })
  }

  /*
   * Back from Google with the browser's back button, the page can come out of the back-forward
   * cache exactly as it was left: spinning. The redirect is over either way, so stop.
   */
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const continueWithGoogle = () => {
    if (busy || redirecting) return
    setRedirecting(true)
    setError(null)
    clearSignInError()
    void startGoogleSignIn().then(
      (result) => {
        // On success the browser is already on its way to Google; the button stays busy.
        if (result.ok) return
        setRedirecting(false)
        setError(result.message ?? 'That did not work.')
      },
      () => {
        setRedirecting(false)
        setError('Could not reach Google just now. Try again, or use your email.')
      },
    )
  }

  const locked = (disabled ?? false) || busy || redirecting
  const stage = sent ? 'code' : known !== null ? 'known' : 'address'

  /*
   * The three stages used to be bare conditional branches, so going from "send a code" to
   * "enter it" was a swap between two unrelated blocks. One fade out, one fade in, in order.
   */
  return (
    <div className="space-y-2">
      {!sent && googleSignInAvailable() && (
        <>
          <Button
            variant="outline"
            className="w-full"
            disabled={locked}
            onClick={continueWithGoogle}
          >
            <GoogleMark />
            {redirecting ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span aria-hidden="true" className="bg-border h-px flex-1" />
            or
            <span aria-hidden="true" className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {/* Spreads nothing when still, as the explainer does: the wrapper stays, the motion goes. */}
        <m.div key={stage} {...(still ? {} : fade)}>
          {sent ? (
            /*
             * The code first, the link second, and that order is the whole point.
             *
             * On an installed app a link opens in the browser, which is a different session and
             * looks exactly like losing the conversation. iOS has no way back into an installed
             * web app, so the fix is not to leave: read six digits, come back, type them here.
             */
            <>
              <p className="text-center text-sm font-medium">
                Check your email and enter the six digits.
              </p>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                /*
                 * Six is what the project sends and what the copy says, and the field still takes
                 * more than six.
                 *
                 * How long the code is lives in the auth config, not in this bundle, and it was
                 * quietly on eight while every number here was six: the email sent eight digits,
                 * the input dropped the last two, and signing in was impossible. The length is set
                 * by `GOTRUE_MAILER_OTP_LENGTH` in the saoi stack overlay now, so the two agree —
                 * but a field that truncates cannot tell anybody what went wrong, and one that
                 * accepts the whole code lets the server reject it with a reason.
                 */
                maxLength={MAX_CODE}
                placeholder="000000"
                aria-label="The code from your email"
                className="text-center text-lg tracking-[0.4em] tabular-nums"
                value={code}
                disabled={locked}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, MAX_CODE))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') enterCode()
                }}
              />
              <Button
                className="w-full"
                disabled={locked || code.length < MIN_CODE}
                onClick={enterCode}
              >
                {busy ? 'Checking…' : 'Continue'}
              </Button>
              <p className="text-muted-foreground text-center text-xs leading-relaxed">
                There is a link in the email too, but it opens a browser. The code keeps you here,
                in this conversation.
              </p>
            </>
          ) : known !== null ? (
            <>
              <Button className="w-full" disabled={locked} onClick={sendCode}>
                <MailIcon className="size-4" />
                {busy ? 'Sending…' : `Send a code to ${maskedAddress(known)}`}
              </Button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground w-full text-center text-xs underline"
                onClick={notMe}
              >
                Not me, or a different address
              </button>
            </>
          ) : (
            <>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-label="Your email address"
                value={email}
                disabled={locked}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendCode()
                }}
              />
              <Button
                className="w-full"
                disabled={locked || email.trim().length === 0}
                onClick={sendCode}
              >
                <MailIcon className="size-4" />
                {busy ? 'Sending…' : 'Send me a code'}
              </Button>
            </>
          )}
        </m.div>
      </AnimatePresence>

      {error !== null && <p className="text-destructive text-center text-xs">{error}</p>}
    </div>
  )
}

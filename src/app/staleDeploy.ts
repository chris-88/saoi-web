import { reloadWhenSafe } from '@/app/reloadGate'

/**
 * Recovering from a deploy that landed while the app was open.
 *
 * Every build hashes its filenames and GitHub Pages swaps the whole site at once, so the moment
 * a deploy finishes, the chunk names a running page knows are gone from the server. A page that
 * has been open across a deploy — a phone in a pocket, a tab left on a desk — asks for
 * `index-OLD.js` on its next navigation, gets a 404, and the import rejects.
 *
 * That page is not broken, it is stale, and a reload fetches the build that does exist. So we
 * reload. The guard is what makes that safe: if a reload does not fix it, the failure is
 * something else, and the customer gets an honest message instead of a tab that reloads forever.
 */

const ATTEMPTED = 'saoi:stale-reload'

/** Long enough to cover a reload, short enough that a later genuine stale load still recovers. */
const WINDOW_MS = 10_000

/** A chunk that could not be fetched, as each engine words it. */
export function isModuleLoadError(error: unknown): boolean {
  // Only the shapes that actually carry a message: stringifying a bare object gives
  // "[object Object]", which matches nothing and reads like a bug when it turns up in a log.
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : ''

  return (
    /importing a module script failed/i.test(message) || // Safari
    /failed to fetch dynamically imported module/i.test(message) || // Chrome
    /error loading dynamically imported module/i.test(message) || // Firefox
    /unable to preload css/i.test(message)
  )
}

/**
 * Reload, unless we just did.
 *
 * Returns whether a reload was started, so the caller can let the error through when it was not.
 */
export function recoverFromStaleDeploy(): boolean {
  try {
    const last = Number(sessionStorage.getItem(ATTEMPTED) ?? '0')
    if (Date.now() - last < WINDOW_MS) return false
    sessionStorage.setItem(ATTEMPTED, String(Date.now()))
  } catch {
    // Private browsing, blocked site data. Without somewhere to record the attempt there is
    // nothing stopping a loop, and a loop is worse than the error page.
    return false
  }

  window.location.reload()
  return true
}

/**
 * A new build has taken over, so show it.
 *
 * The preload guard above catches one kind of staleness: a tab that was open across a deploy
 * and reaches for a chunk that no longer exists. It cannot catch the other kind, which is the
 * common one. The service worker precaches the whole shell, so a returning visitor is served a
 * complete and self-consistent copy of the build they saw last time. Nothing 404s, nothing
 * errors, and the page simply renders yesterday's product on top of today's deploy.
 *
 * `autoUpdate` installs the new worker and claims the page, which fires `controllerchange`.
 * That is the signal that the assets underneath have changed, and a single guarded reload is
 * what turns it into the new build being on screen.
 *
 * The reload waits for anything it would cost the customer (`reloadGate`): a half-written
 * message, or a reply still streaming in.
 *
 * Call it once, at start-up. The guard in `recoverFromStaleDeploy` is what stops a worker that
 * claims repeatedly from putting the page in a loop.
 */
export function reloadWhenWorkerTakesOver(options: WorkerTakeover = {}): void {
  const container = options.container ?? serviceWorkers()
  if (container === undefined) return
  const controlled = options.hadController ?? hadController
  const reload = options.reload ?? recoverFromStaleDeploy

  container.addEventListener('controllerchange', () => {
    /*
     * Only when there was already a worker. The first registration on a first visit also fires
     * this, and reloading somebody the instant they arrive is a worse bug than the one being
     * fixed: they asked for the page, they are looking at the page, nothing is stale.
     */
    if (!controlled) return
    reloadWhenSafe(() => void reload(), options.doc)
  })
}

/** The browser, unless a test hands in its own. */
export type WorkerTakeover = {
  readonly container?: ServiceWorkerContainer | undefined
  readonly doc?: Document | undefined
  readonly reload?: (() => unknown) | undefined
  readonly hadController?: boolean | undefined
}

/** How often an open page looks for a new build: an installed app can stay open for days. */
const UPDATE_EVERY_MS = 60 * 60_000

/** The least time between two looks, so flicking between apps does not fetch `sw.js` each time. */
const UPDATE_GAP_MS = 60_000

/** The browser, unless a test hands in its own. */
export type UpdateChecks = {
  readonly container?: ServiceWorkerContainer | undefined
  readonly doc?: Document | undefined
  readonly everyMs?: number | undefined
  readonly gapMs?: number | undefined
}

/**
 * Look for a new build whenever the page comes back into view, and every hour.
 *
 * The worker is registered on `load`, which is also the browser's update check. An installed app
 * brought back from the background is not loaded again, so without this it would run the build
 * it opened on until somebody closed it for good. `registration.update()` fetches `sw.js`; a new
 * one installs, skips waiting, claims the page, and `reloadWhenWorkerTakesOver` reloads into it
 * once that costs the customer nothing.
 *
 * Call it once, at start-up. Returns a function that stops it.
 */
export function checkForUpdates(options: UpdateChecks = {}): () => void {
  const container = options.container ?? serviceWorkers()
  if (container === undefined) return () => undefined
  const doc = options.doc ?? document
  const gapMs = options.gapMs ?? UPDATE_GAP_MS

  // The `load`-time registration has just looked.
  let last = Date.now()
  const check = (): void => {
    if (Date.now() - last < gapMs) return
    last = Date.now()
    // Offline, or the worker script unreachable: nothing to do until the next look.
    container
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined)
  }
  const onVisibility = (): void => {
    if (doc.visibilityState === 'visible') check()
  }

  doc.addEventListener('visibilitychange', onVisibility)
  const timer = window.setInterval(check, options.everyMs ?? UPDATE_EVERY_MS)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    window.clearInterval(timer)
  }
}

function serviceWorkers(): ServiceWorkerContainer | undefined {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker
    : undefined
}

/** The worker serving this page when it started (null: none), and so the build it runs. */
const controllerAtLoad: ServiceWorker | null =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker.controller
    : null

/** Whether this page was being served by a worker when it started. */
const hadController = controllerAtLoad !== null

const BUILD_ATTEMPTED = 'saoi:contract-reload'

/**
 * One reload per five minutes for a response the page cannot read. Long enough to cover a slow
 * phone's reload and its first call, so a server that genuinely changed shape is met with one
 * reload and then a message, never a page that keeps reloading.
 */
const BUILD_WINDOW_MS = 5 * 60_000

/** How long to wait for a newer worker to finish installing before saying so instead. */
const INSTALL_WAIT_MS = 15_000

/** The browser, unless a test hands in its own. */
export type BuildRecovery = {
  readonly container?: ServiceWorkerContainer | undefined
  readonly storage?: Storage | undefined
  readonly reload?: (() => void) | undefined
  readonly controllerAtLoad?: ServiceWorker | null | undefined
  readonly waitMs?: number | undefined
}

/** Reload the page: the "Reload" chip, and the recovery below. */
export function reloadPage(): void {
  window.location.reload()
}

/**
 * A response this build cannot read: reload into the newer build, if there is one.
 *
 * The worker serves the build it precached, so a page opened after a deploy runs the old bundle
 * until the new worker has downloaded the new shell and taken over (`reloadWhenWorkerTakesOver`
 * then reloads). When the server's contract moved in the same release, the old bundle's Zod parse
 * rejects a good response in the meantime, and the customer sees a failure that is really an
 * old page. A reload fixes that only when a newer worker exists, so this asks for one
 * (`registration.update()`), lets it take over (`SKIP_WAITING`, for a worker left waiting) and
 * reloads once it is active.
 *
 * Resolves `true` when a reload has started, so the caller can hold its loading state while the
 * page goes away; `false` when there is no newer build or the guard refused, so the caller says
 * the page needs a reload instead. Never rejects.
 */
export async function reloadIntoNewerBuild(options: BuildRecovery = {}): Promise<boolean> {
  const container =
    options.container ??
    (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : undefined)
  if (container === undefined) return false
  const reload = options.reload ?? reloadPage
  const atLoad =
    options.controllerAtLoad === undefined ? controllerAtLoad : options.controllerAtLoad

  let storage: Storage
  try {
    storage = options.storage ?? sessionStorage
    const last = Number(storage.getItem(BUILD_ATTEMPTED) ?? '0')
    if (Date.now() - last < BUILD_WINDOW_MS) return false
  } catch {
    // Nowhere to record the attempt means nothing to stop a loop: say so instead.
    return false
  }

  const go = (): true => {
    try {
      storage.setItem(BUILD_ATTEMPTED, String(Date.now()))
    } catch {
      // Readable a moment ago; and if not, refusing would leave them on the old build.
    }
    reload()
    return true
  }

  try {
    // A newer worker has already taken this page over: everything under it is newer than us.
    if (atLoad !== null && container.controller !== null && container.controller !== atLoad) {
      return go()
    }

    const registration = await container.getRegistration()
    if (registration === undefined) return false

    let next = registration.waiting ?? registration.installing
    if (next === null) {
      await registration.update()
      next = registration.waiting ?? registration.installing
    }
    if (next === null) return false

    return (await activated(next, options.waitMs ?? INSTALL_WAIT_MS)) ? go() : false
  } catch {
    // An update check that fails (offline, the worker script unreachable) finds no newer build.
    return false
  }
}

/**
 * Resolves `true` once the worker is active, `false` if it fails to install or takes too long.
 *
 * This app's worker skips waiting by itself (`registerType: 'autoUpdate'`); the message is the
 * Workbox convention for one that does not, so a worker found waiting is never left there.
 */
function activated(worker: ServiceWorker, waitMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const settle = (result: boolean): void => {
      window.clearTimeout(timer)
      worker.removeEventListener('statechange', check)
      resolve(result)
    }
    const check = (): void => {
      if (worker.state === 'activated') settle(true)
      else if (worker.state === 'redundant') settle(false)
      else if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' })
    }
    const timer = window.setTimeout(() => {
      settle(false)
    }, waitMs)
    worker.addEventListener('statechange', check)
    check()
  })
}

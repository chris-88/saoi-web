import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkForUpdates,
  isModuleLoadError,
  reloadIntoNewerBuild,
  reloadWhenWorkerTakesOver,
} from '@/app/staleDeploy'
import { holdReload } from '@/app/reloadGate'

/*
 * The strings are the test.
 *
 * Each engine words a failed chunk fetch differently and none of them is an error subclass we
 * could check with `instanceof`, so matching the wording is all there is. If a browser changes
 * its phrasing the recovery silently stops working, and the only warning would be a customer
 * seeing an error page after a deploy — so the exact strings are pinned here.
 */
describe('isModuleLoadError', () => {
  it.each([
    ['Safari', 'Importing a module script failed.'],
    ['Chrome', 'Failed to fetch dynamically imported module: https://app.saoi.ie/assets/x.js'],
    ['Firefox', 'error loading dynamically imported module'],
    ['Vite CSS preload', 'Unable to preload CSS for /assets/index-abc.css'],
  ])('recognises %s', (_engine, message) => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true)
  })

  it('leaves ordinary failures alone', () => {
    expect(isModuleLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isModuleLoadError(new Error('NetworkError when attempting to fetch resource.'))).toBe(
      false,
    )
  })

  it('does not stringify a bare object into a match', () => {
    expect(isModuleLoadError({ status: 404 })).toBe(false)
    expect(isModuleLoadError(null)).toBe(false)
  })
})

/** A worker that moves through the states a browser would put it through. */
class FakeWorker extends EventTarget {
  state: ServiceWorkerState
  constructor(state: ServiceWorkerState) {
    super()
    this.state = state
  }
  readonly messages: unknown[] = []
  postMessage(message: unknown): void {
    this.messages.push(message)
    if ((message as { type?: string }).type === 'SKIP_WAITING') this.become('activated')
  }
  become(state: ServiceWorkerState): void {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

type FakeRegistration = {
  waiting: FakeWorker | null
  installing: FakeWorker | null
  update: () => Promise<void>
}

function browser({
  registration = { waiting: null, installing: null, update: () => Promise.resolve() },
  controller = null,
}: {
  registration?: FakeRegistration | undefined
  controller?: FakeWorker | null
} = {}) {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  } as unknown as Storage
  const container = {
    controller,
    getRegistration: () => Promise.resolve(registration),
  } as unknown as ServiceWorkerContainer
  const reload = vi.fn<() => void>()
  return { container, storage, reload, store }
}

describe('reloadIntoNewerBuild', () => {
  it('asks for an update, waits for the new worker to take over, then reloads once', async () => {
    const next = new FakeWorker('installing')
    const registration: FakeRegistration = {
      waiting: null,
      installing: null,
      update: vi.fn(() => {
        registration.installing = next
        return Promise.resolve()
      }),
    }
    const env = browser({ registration, controller: new FakeWorker('activated') })
    const recovering = reloadIntoNewerBuild({ ...env, controllerAtLoad: env.container.controller })

    await vi.waitFor(() => {
      expect(registration.update).toHaveBeenCalledTimes(1)
    })
    expect(env.reload).not.toHaveBeenCalled()
    next.become('installed')
    next.become('activating')
    next.become('activated')

    await expect(recovering).resolves.toBe(true)
    expect(env.reload).toHaveBeenCalledTimes(1)
  })

  it('tells a worker left waiting to skip waiting', async () => {
    const waiting = new FakeWorker('installed')
    const env = browser({
      registration: { waiting, installing: null, update: () => Promise.resolve() },
    })
    await expect(reloadIntoNewerBuild({ ...env, controllerAtLoad: null })).resolves.toBe(true)
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }])
    expect(env.reload).toHaveBeenCalledTimes(1)
  })

  it('reloads at once when a newer worker has already taken the page over', async () => {
    const old = new FakeWorker('redundant') as unknown as ServiceWorker
    const update = vi.fn(() => Promise.resolve())
    const env = browser({
      controller: new FakeWorker('activated'),
      registration: { waiting: null, installing: null, update },
    })
    await expect(reloadIntoNewerBuild({ ...env, controllerAtLoad: old })).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(env.reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing when there is no newer build: the server really did change', async () => {
    const env = browser({ controller: null })
    await expect(reloadIntoNewerBuild({ ...env, controllerAtLoad: null })).resolves.toBe(false)
    expect(env.reload).not.toHaveBeenCalled()
  })

  it('reloads once, then lets the error through, however many updates appear', async () => {
    const env = browser()
    const fresh = () => {
      env.container.getRegistration = () =>
        Promise.resolve({
          waiting: new FakeWorker('installed'),
          installing: null,
          update: () => Promise.resolve(),
        } as unknown as ServiceWorkerRegistration)
    }
    fresh()
    await expect(reloadIntoNewerBuild({ ...env, controllerAtLoad: null })).resolves.toBe(true)
    // The reloaded page, still failing: the flag in session storage holds it.
    fresh()
    await expect(reloadIntoNewerBuild({ ...env, controllerAtLoad: null })).resolves.toBe(false)
    expect(env.reload).toHaveBeenCalledTimes(1)
    expect(env.store.has('saoi:contract-reload')).toBe(true)
  })

  it('gives up on a worker that fails to install, or takes too long', async () => {
    const failing = new FakeWorker('installing')
    const env = browser({
      registration: { waiting: null, installing: failing, update: () => Promise.resolve() },
    })
    const recovering = reloadIntoNewerBuild({ ...env, controllerAtLoad: null })
    failing.become('redundant')
    await expect(recovering).resolves.toBe(false)

    const slow = browser({
      registration: {
        waiting: null,
        installing: new FakeWorker('installing'),
        update: () => Promise.resolve(),
      },
    })
    await expect(
      reloadIntoNewerBuild({ ...slow, controllerAtLoad: null, waitMs: 5 }),
    ).resolves.toBe(false)
    expect(env.reload).not.toHaveBeenCalled()
    expect(slow.reload).not.toHaveBeenCalled()
  })

  it('does not reload without somewhere to record it, or when the update check fails', async () => {
    const blocked = browser({
      registration: {
        waiting: new FakeWorker('installed'),
        installing: null,
        update: () => Promise.resolve(),
      },
    })
    const storage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    } as unknown as Storage
    await expect(
      reloadIntoNewerBuild({ ...blocked, storage, controllerAtLoad: null }),
    ).resolves.toBe(false)

    const offline = browser({
      registration: {
        waiting: null,
        installing: null,
        update: () => Promise.reject(new TypeError('Failed to fetch')),
      },
    })
    await expect(reloadIntoNewerBuild({ ...offline, controllerAtLoad: null })).resolves.toBe(false)
    expect(blocked.reload).not.toHaveBeenCalled()
    expect(offline.reload).not.toHaveBeenCalled()
  })
})

/** A document whose visibility the test moves. */
class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
  become(state: DocumentVisibilityState): void {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

describe('checkForUpdates', () => {
  const HOUR = 60 * 60_000
  const stops: (() => void)[] = []

  afterEach(() => {
    for (const stop of stops.splice(0)) stop()
    vi.useRealTimers()
  })

  function installed(update = vi.fn(() => Promise.resolve())) {
    const doc = new FakeDocument()
    const container = {
      getRegistration: () => Promise.resolve({ update }),
    } as unknown as ServiceWorkerContainer
    stops.push(checkForUpdates({ container, doc: doc as unknown as Document }))
    return { doc, update }
  }

  it('looks for a new build every hour while the app stays open', async () => {
    vi.useFakeTimers()
    const { update } = installed()

    await vi.advanceTimersByTimeAsync(HOUR - 1)
    expect(update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(HOUR * 2)
    expect(update).toHaveBeenCalledTimes(3)
  })

  it('looks again when the app comes back into view, not when it goes away', async () => {
    vi.useFakeTimers()
    const { doc, update } = installed()
    await vi.advanceTimersByTimeAsync(5 * 60_000)

    doc.become('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(update).not.toHaveBeenCalled()

    doc.become('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('does not fetch the worker again for every flick between apps', async () => {
    vi.useFakeTimers()
    const { doc, update } = installed()

    // Within a minute of the load-time check: that check stands.
    doc.become('hidden')
    doc.become('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(update).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    doc.become('hidden')
    doc.become('visible')
    doc.become('hidden')
    doc.become('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('shrugs off a failed check (offline) and tries again next time', async () => {
    vi.useFakeTimers()
    const update = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    installed(update)

    await vi.advanceTimersByTimeAsync(HOUR * 2)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('stops when asked', async () => {
    vi.useFakeTimers()
    const { doc, update } = installed()
    for (const stop of stops.splice(0)) stop()

    await vi.advanceTimersByTimeAsync(HOUR * 2)
    doc.become('visible')
    expect(update).not.toHaveBeenCalled()
  })
})

describe('reloadWhenWorkerTakesOver', () => {
  function page(hadController: boolean) {
    const container = new EventTarget() as unknown as ServiceWorkerContainer
    const doc = new FakeDocument()
    const reload = vi.fn()
    reloadWhenWorkerTakesOver({
      container,
      doc: doc as unknown as Document,
      reload,
      hadController,
    })
    const takeOver = () => container.dispatchEvent(new Event('controllerchange'))
    return { doc, reload, takeOver }
  }

  it('reloads into the new build when it takes over', () => {
    const { reload, takeOver } = page(true)
    takeOver()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves a first visit alone', () => {
    const { reload, takeOver } = page(false)
    takeOver()
    expect(reload).not.toHaveBeenCalled()
  })

  it('waits for a message being written, and for a reply streaming in', () => {
    const { doc, reload, takeOver } = page(true)
    const draft = holdReload('draft')
    const streaming = holdReload('streaming')

    takeOver()
    doc.become('hidden')
    expect(reload).not.toHaveBeenCalled()

    streaming()
    expect(reload).toHaveBeenCalledTimes(1)
    draft()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

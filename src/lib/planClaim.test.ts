import { describe, expect, it, vi } from 'vitest'
import { SaoiApiError } from '@/api/client'
import type { PreviewPlanResponse } from '@contracts/session.ts'
import {
  arrive,
  cameFromPlanInAnotherAccount,
  inAnotherAccountState,
  PROBLEM_LINES,
  type ArrivalSteps,
} from '@/lib/planClaim'

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAA'
const PREVIEW = { title: 'A plan' } as unknown as PreviewPlanResponse
const used = () => new SaoiApiError(409, 'used')

function steps(overrides: Partial<ArrivalSteps> = {}) {
  return {
    preview: vi.fn<ArrivalSteps['preview']>(() => Promise.resolve(PREVIEW)),
    claim: vi.fn<ArrivalSteps['claim']>(() => Promise.resolve({ reopened: true })),
    signedIn: vi.fn<ArrivalSteps['signedIn']>(() => Promise.resolve(false)),
    ...overrides,
  }
}

describe('opening a plan link', () => {
  it('shows a plan nobody has opened, and claims nothing', async () => {
    const s = steps()
    await expect(arrive(TOKEN, s)).resolves.toEqual({ kind: 'preview', preview: PREVIEW })
    expect(s.claim).not.toHaveBeenCalled()
  })

  it('a claimed plan: tries the claim at once, and the same browser is back in', async () => {
    const s = steps({ preview: () => Promise.reject(used()) })
    await expect(arrive(TOKEN, s)).resolves.toEqual({ kind: 'reopened' })
    expect(s.claim).toHaveBeenCalledWith(TOKEN)
  })

  it('claimed by another browser, not signed in: the 409 stands, for the used-elsewhere state', async () => {
    const s = steps({ preview: () => Promise.reject(used()), claim: () => Promise.reject(used()) })
    await expect(arrive(TOKEN, s)).rejects.toBeInstanceOf(SaoiApiError)
  })

  it('claimed by another account while signed in: the conversation is in that account', async () => {
    const s = steps({
      preview: () => Promise.reject(used()),
      claim: () => Promise.reject(used()),
      signedIn: () => Promise.resolve(true),
    })
    await expect(arrive(TOKEN, s)).resolves.toEqual({ kind: 'inAnotherAccount' })
  })

  it('expired and unknown links are refused as before, without a claim', async () => {
    for (const status of [404, 410]) {
      const s = steps({ preview: () => Promise.reject(new SaoiApiError(status, '')) })
      await expect(arrive(TOKEN, s)).rejects.toMatchObject({ status })
      expect(s.claim).not.toHaveBeenCalled()
    }
  })

  it('a claim that fails another way surfaces that failure', async () => {
    const s = steps({
      preview: () => Promise.reject(used()),
      claim: () => Promise.reject(new SaoiApiError(429, 'busy')),
    })
    await expect(arrive(TOKEN, s)).rejects.toMatchObject({ status: 429 })
    expect(s.signedIn).not.toHaveBeenCalled()
  })
})

describe('the words', () => {
  it('a used link was opened on another device, and signing in brings the conversation', () => {
    expect(PROBLEM_LINES.used).toBe(
      'This link was opened on another device. If you signed in to Saoi there, sign in here and your conversation is in your list.',
    )
  })

  it('the conversations list knows it was sent by a plan link, and nothing else', () => {
    expect(cameFromPlanInAnotherAccount(inAnotherAccountState)).toBe(true)
    expect(cameFromPlanInAnotherAccount(null)).toBe(false)
    expect(cameFromPlanInAnotherAccount({ planInAnotherAccount: 'yes' })).toBe(false)
  })
})

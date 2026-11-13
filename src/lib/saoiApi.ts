import { z } from 'zod'
import { api, apiError, publicApi, SaoiApiError } from '@/api/client'
import type { components } from '@/api/schema'
import {
  claimPlanResponseSchema,
  previewPlanResponseSchema,
  listCasesResponseSchema,
  sessionResponseSchema,
  type SessionRequest,
} from '@contracts/session.ts'
import { partnerViewSchema, type PartnerRequest } from '@contracts/partner.ts'
import { caseActionResponseSchema, type CaseActionRequest } from '@contracts/case-action.ts'
import {
  caseFeedReadySchema,
  caseFeedUpdateSchema,
  caseHistorySchema,
  caseSnapshotSchema,
  type CaseFeedReady,
  type CaseFeedUpdate,
  type CaseHistory,
  type CaseSnapshot,
} from '@contracts/case-read.ts'
import {
  caseAlertsResponseSchema,
  reminderSchema,
  type CaseAlertsResponse,
  type CreateReminderBody,
  type Reminder,
} from '@contracts/alerts.ts'
import {
  caseHoldingsResponseSchema,
  holdingSchema,
  type CaseHoldingsResponse,
  type CreateHoldingBody,
  type Holding,
  type UpdateHoldingBody,
} from '@contracts/holdings.ts'
import type { CasePlanEdit, CasePlanEdited } from '@contracts/case-plan.ts'
import type { Client } from 'openapi-fetch'
import {
  casePlanEditedReadSchema,
  casePlanReadSchema,
  planChoiceRequestSchema,
  type CasePlanRead,
  type PlanChoiceRequest,
  type PlanChoiceSlot,
} from '@/lib/planChoices'

export { SaoiApiError }

/**
 * The customer's calls to `saoi-api`, through the typed client in `@/api/client`.
 *
 * The client checks paths and request bodies against the service's OpenAPI document at
 * compile time; every response is still parsed against its Zod contract here, so a drifting
 * server is a loud error and not a half-rendered card.
 */

type ApiResult = { readonly data?: unknown; readonly error?: unknown; readonly response: Response }

async function parsed<T extends z.ZodType>(
  call: Promise<ApiResult>,
  schema: T,
): Promise<z.infer<T>> {
  const { data, error, response } = await call
  if (!response.ok) throw apiError(response.status, error)
  return schema.parse(data)
}

/**
 * A request body as it goes over the wire: keys whose value is `undefined` dropped, at any depth.
 *
 * Zod infers an optional field as `?: T | undefined`; the generated types say `?: T`, and
 * with `exactOptionalPropertyTypes` those differ. In JSON they are the same thing, so the body
 * is put through JSON, which is what `fetch` would have done to it anyway.
 */
type Compact<T> = T extends readonly (infer U)[]
  ? Compact<U>[]
  : T extends object
    ? { [K in keyof T]: Compact<Exclude<T[K], undefined>> }
    : T
function compact<T>(value: T): Compact<T> {
  return JSON.parse(JSON.stringify(value)) as Compact<T>
}

export function fetchCaseSnapshot(caseId: string): Promise<CaseSnapshot> {
  return parsed(
    api.GET('/api/cases/{caseId}/snapshot', { params: { path: { caseId } } }),
    caseSnapshotSchema,
  )
}

export function fetchCaseHistory(caseId: string): Promise<CaseHistory> {
  return parsed(
    api.GET('/api/cases/{caseId}/history', { params: { path: { caseId } } }),
    caseHistorySchema,
  )
}

/** The case's alerts, newest first, and its open reminders. Reading them marks the alerts seen. */
export function fetchCaseAlerts(caseId: string): Promise<CaseAlertsResponse> {
  return parsed(
    api.GET('/api/cases/{caseId}/alerts', { params: { path: { caseId } } }),
    caseAlertsResponseSchema,
  )
}

/** A date the customer gave, to be reminded of. The server holds the date to today or later. */
export function createReminder(caseId: string, body: CreateReminderBody): Promise<Reminder> {
  return parsed(
    api.POST('/api/cases/{caseId}/reminders', {
      params: { path: { caseId } },
      body: compact(body),
    }),
    reminderSchema,
  )
}

/** No further alerts for the reminder; the alerts already raised stay. */
export async function deleteReminder(caseId: string, reminderId: string): Promise<void> {
  const { error, response } = await api.DELETE('/api/cases/{caseId}/reminders/{reminderId}', {
    params: { path: { caseId, reminderId } },
  })
  if (!response.ok) throw apiError(response.status, error)
}

/** The accounts and debts on the case, and progress against the claimed plan (null without one). */
export function fetchCaseHoldings(caseId: string): Promise<CaseHoldingsResponse> {
  return parsed(
    api.GET('/api/cases/{caseId}/holdings', { params: { path: { caseId } } }),
    caseHoldingsResponseSchema,
  )
}

/** An account or a debt the customer entered. A `fixedUntil` keeps a reminder with it. */
export function createHolding(caseId: string, body: CreateHoldingBody): Promise<Holding> {
  return parsed(
    api.POST('/api/cases/{caseId}/holdings', {
      params: { path: { caseId } },
      body: compact(body),
    }),
    holdingSchema,
  )
}

/** What changed on a holding; a null clears that field. */
export function updateHolding(
  caseId: string,
  holdingId: string,
  body: UpdateHoldingBody,
): Promise<Holding> {
  return parsed(
    api.PATCH('/api/cases/{caseId}/holdings/{holdingId}', {
      params: { path: { caseId, holdingId } },
      body: compact(body),
    }),
    holdingSchema,
  )
}

/** Deletes a holding and the reminder kept with it. */
export async function deleteHolding(caseId: string, holdingId: string): Promise<void> {
  const { error, response } = await api.DELETE('/api/cases/{caseId}/holdings/{holdingId}', {
    params: { path: { caseId, holdingId } },
  })
  if (!response.ok) throw apiError(response.status, error)
}

/**
 * The plan claimed on the case, as the profile shows it, or null when there is none (the
 * server's 404). Any other failure is thrown.
 */
export async function fetchCasePlan(caseId: string): Promise<CasePlanRead | null> {
  const { data, error, response } = await api.GET('/api/cases/{caseId}/plan', {
    params: { path: { caseId } },
  })
  if (response.status === 404) return null
  if (!response.ok) throw apiError(response.status, error)
  return casePlanReadSchema.parse(data)
}

/**
 * Changes the plan's own figures (only the fields given). The server recomputes the plan,
 * writes a `plan_edited` event and returns the plan with one sentence of what the edit changed.
 */
export function updateCasePlan(caseId: string, body: CasePlanEdit): Promise<CasePlanEdited> {
  return parsed(
    api.PATCH('/api/cases/{caseId}/plan', {
      params: { path: { caseId } },
      body: compact(body),
    }),
    casePlanEditedReadSchema,
  )
}

/** One response of the choices routes, as `openapi-typescript` writes it. */
type PlanResponses = {
  200: { headers: { [name: string]: unknown }; content: { 'application/json': unknown } }
  default: { headers: { [name: string]: unknown }; content: { 'application/json': unknown } }
}
type NoParams = { query?: never; header?: never; path?: never; cookie?: never }

/**
 * The two choices routes, typed by hand until `npm run api:generate` reads them from the
 * deployed OpenAPI document (saoi `feat/plan-choices`); then `api` covers them and this goes.
 */
type PlanChoicePaths = {
  '/api/cases/{caseId}/plan/choices': {
    parameters: NoParams
    post: {
      parameters: { query?: never; header?: never; path: { caseId: string }; cookie?: never }
      requestBody: { content: { 'application/json': PlanChoiceRequest } }
      responses: PlanResponses
    }
  }
  '/api/cases/{caseId}/plan/choices/{slot}': {
    parameters: NoParams
    delete: {
      parameters: {
        query?: never
        header?: never
        path: { caseId: string; slot: PlanChoiceSlot }
        cookie?: never
      }
      requestBody?: never
      responses: PlanResponses
    }
  }
}
/** The same client, bearer and all, seen through the hand-written paths. */
const choicesApi = api as unknown as Client<PlanChoicePaths>

/**
 * The customer's own tap choosing a product for one slot of their plan (the model proposes, the
 * UI commits). Replaces whatever that slot held. Returns the plan with its choices; the server
 * narrates the choice on the next turn, so nothing is said here.
 */
export function choosePlanProduct(caseId: string, body: PlanChoiceRequest): Promise<CasePlanRead> {
  return parsed(
    choicesApi.POST('/api/cases/{caseId}/plan/choices', {
      params: { path: { caseId } },
      body: planChoiceRequestSchema.parse(body),
    }),
    casePlanReadSchema,
  )
}

/** Clears one slot's choice. Returns the plan with its choices. */
export function removePlanChoice(caseId: string, slot: PlanChoiceSlot): Promise<CasePlanRead> {
  return parsed(
    choicesApi.DELETE('/api/cases/{caseId}/plan/choices/{slot}', {
      params: { path: { caseId, slot } },
    }),
    casePlanReadSchema,
  )
}

const registeredSchema = z.object({ registered: z.literal(true) })
const uploadedSchema = z.object({ fileName: z.string() }).loose()

const presenterHeader = (key: string | undefined) =>
  key === undefined ? {} : { 'x-presenter-key': key }

/**
 * The session actions, each sent to its own route. The presenter key travels in a header, not
 * in the body.
 */
export function callSessionApi(request: SessionRequest): Promise<unknown> {
  switch (request.action) {
    case 'start': {
      const { action: _action, ...body } = request
      return parsed(api.POST('/api/sessions', { body: compact(body) }), sessionResponseSchema)
    }
    case 'new_case':
      return parsed(api.POST('/api/cases', { body: { mode: request.mode } }), sessionResponseSchema)
    case 'list_cases':
      return parsed(
        api.GET('/api/cases', { params: { header: presenterHeader(request.presenterKey) } }),
        listCasesResponseSchema,
      )
    case 'switch_case':
      return parsed(
        api.POST('/api/cases/{caseId}/switch', {
          params: {
            path: { caseId: request.caseId },
            header: presenterHeader(request.presenterKey),
          },
        }),
        sessionResponseSchema,
      )
    case 'claim_participant':
      return parsed(
        api.POST('/api/sessions/claim', { body: { priorAuthUserId: request.priorAuthUserId } }),
        sessionResponseSchema,
      )
    case 'register_interest': {
      const { action: _action, ...body } = request
      return parsed(api.POST('/api/interest', { body: compact(body) }), registeredSchema)
    }
  }
}

/** Reads a saved comparison by its link, without spending it, for the welcome. No session. */
export function callPreviewPlanApi(token: string): Promise<unknown> {
  return parsed(
    publicApi.POST('/api/plans/preview', { body: { token } }),
    previewPlanResponseSchema,
  )
}

/** Opens a saved plan's one-time link into this browser's conversation. */
export function callClaimPlanApi(token: string): Promise<unknown> {
  return parsed(api.POST('/api/plans/claim', { body: { token } }), claimPlanResponseSchema)
}

/** The partner's actions, one route each. Returns the partner's view. */
export function callPartnerApi(request: PartnerRequest): Promise<unknown> {
  switch (request.action) {
    case 'join':
      return parsed(
        api.POST('/api/partner/join', { body: { token: request.token } }),
        partnerViewSchema,
      )
    case 'tasks':
      return parsed(api.GET('/api/partner/tasks'), partnerViewSchema)
    case 'submit':
      return parsed(
        api.POST('/api/partner/submit', { body: { answers: request.answers } }),
        partnerViewSchema,
      )
  }
}

const subscribedSchema = z.object({ subscribed: z.literal(true) })

/**
 * The case actions, each sent to its resource route. The caller's role is enforced by the
 * server's policy table, not here: a partner's browser gets a 403 for every one of these.
 */
export function callCaseActionApi(
  request: CaseActionRequest,
  /** The open case, for the actions that name an application and not a case. */
  openCaseId?: string,
): Promise<unknown> {
  const done = (call: Promise<ApiResult>) => parsed(call, caseActionResponseSchema)
  // The routes for an application are addressed by the case as well.
  const onApplication = (
    applicationId: string,
    send: (path: { caseId: string; applicationId: string }) => Promise<ApiResult>,
  ) => {
    if (openCaseId === undefined) {
      return Promise.reject(new Error('Which conversation is this for?'))
    }
    return done(send({ caseId: openCaseId, applicationId }))
  }
  const caseOf = (caseId: string) => ({ params: { path: { caseId } } })

  switch (request.action) {
    case 'select_products':
      return done(
        api.POST('/api/cases/{caseId}/products/select', {
          ...caseOf(request.caseId),
          body: { products: compact(request.products) },
        }),
      )
    case 'decline_product':
      return done(
        api.POST('/api/cases/{caseId}/products/{product}/decline', {
          params: { path: { caseId: request.caseId, product: request.product } },
        }),
      )
    case 'confirm_requirement':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/confirm', {
          params: { path },
          body: { requirementId: request.requirementId },
        }),
      )
    case 'submit_application':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/submit', {
          params: { path },
          body: { confirmations: request.confirmations },
        }),
      )
    case 'pause_application':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/pause', { params: { path } }),
      )
    case 'resume_application':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/resume', { params: { path } }),
      )
    case 'decide_plan':
      return done(
        api.POST('/api/cases/{caseId}/plans/{planId}/decisions', {
          params: { path: { caseId: request.caseId, planId: request.planId } },
          body: { decision: request.decision },
        }),
      )
    case 'invite_partner':
      return done(
        api.POST('/api/cases/{caseId}/invites', {
          ...caseOf(request.caseId),
          body: { name: request.name },
        }),
      )
    case 'subscribe_push':
      return parsed(
        api.POST('/api/cases/{caseId}/push-subscriptions', {
          ...caseOf(request.caseId),
          body: { endpoint: request.endpoint, p256dh: request.p256dh, auth: request.auth },
        }),
        subscribedSchema,
      )
    case 'grant_consent':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/consent', {
          params: { path },
          body: { requirementId: request.requirementId },
        }),
      )
    case 'confirm_form_declarations':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/form-declarations', {
          params: { path },
          body: { fieldIds: request.fieldIds },
        }),
      )
    case 'submit_health_form':
      return onApplication(request.applicationId, (path) =>
        api.POST('/api/cases/{caseId}/applications/{applicationId}/health-answers', {
          params: { path },
          body: { values: request.values },
        }),
      )
    case 'link_accounts':
      return done(
        api.POST('/api/cases/{caseId}/linked-accounts', {
          ...caseOf(request.caseId),
          body: { bank: request.bank, scope: request.scope },
        }),
      )
    case 'revoke_accounts':
      return done(api.POST('/api/cases/{caseId}/linked-accounts/revoke', caseOf(request.caseId)))
    case 'initiate_transfer':
      return done(
        api.POST('/api/cases/{caseId}/transfers', {
          ...caseOf(request.caseId),
          body: {
            fromAccountId: request.fromAccountId,
            toApplicationId: request.toApplicationId,
            amount: request.amount,
            cadence: request.cadence,
          },
        }),
      )
    case 'give_feedback': {
      const { action: _action, caseId, ...body } = request
      return done(
        api.POST('/api/cases/{caseId}/feedback', { ...caseOf(caseId), body: compact(body) }),
      )
    }
  }
}

/**
 * `upload`: a multipart body addressed to the case.
 *
 * The generated type describes the fields; the `FormData` itself is what is sent, so the browser
 * sets the multipart boundary.
 */
export function uploadDocumentApi(caseId: string, form: FormData): Promise<unknown> {
  return parsed(
    api.POST('/api/cases/{caseId}/documents', {
      params: { path: { caseId } },
      body: form as unknown as components['schemas']['UploadDocument'],
      bodySerializer: () => form,
    }),
    uploadedSchema,
  )
}

export type CaseFeedHandlers = {
  /** On every (re)connect: the newest narratable event, for a baseline. */
  readonly onReady: (ready: CaseFeedReady) => void
  readonly onUpdate: (update: CaseFeedUpdate) => void
}

const RETRY_MIN_MS = 1_000
const RETRY_MAX_MS = 30_000

/**
 * Follows the change feed until `signal` aborts, reconnecting with backoff and `Last-Event-ID`.
 *
 * `fetch` rather than `EventSource`, which cannot send the Authorization header. Resolves when
 * aborted. A 401 or 404 is not retried: nothing a retry does changes it.
 */
export async function followCaseFeed(
  caseId: string,
  handlers: CaseFeedHandlers,
  signal: AbortSignal,
): Promise<void> {
  let lastEventId: string | undefined
  let delay = RETRY_MIN_MS

  while (!signal.aborted) {
    try {
      const { response, error } = await api.GET('/api/cases/{caseId}/events', {
        params: { path: { caseId } },
        headers: {
          Accept: 'text/event-stream',
          ...(lastEventId === undefined ? {} : { 'Last-Event-ID': lastEventId }),
        },
        parseAs: 'stream',
        signal,
      })
      if (!response.ok || !response.body) {
        throw apiError(response.status, error)
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += value.replace(/\r\n/g, '\n')

        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const frame = parseFrame(buffer.slice(0, boundary))
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')
          if (frame === null) continue

          delay = RETRY_MIN_MS
          dispatch(frame, handlers, (id) => {
            lastEventId = id
          })
        }
      }
    } catch (error) {
      if (signal.aborted) return
      if (error instanceof SaoiApiError && (error.status === 401 || error.status === 404)) return
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay)
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
    })
    delay = Math.min(delay * 2, RETRY_MAX_MS)
  }
}

type Frame = { readonly event: string; readonly data: string; readonly id?: string }

/** One SSE frame. Comment lines (the keep-alive) and frames without data are `null`. */
function parseFrame(text: string): Frame | null {
  let event = 'message'
  let id: string | undefined
  const data: string[] = []
  for (const line of text.split('\n')) {
    if (line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
    else if (field === 'id') id = value
  }
  if (data.length === 0) return null
  return { event, data: data.join('\n'), ...(id === undefined ? {} : { id }) }
}

function dispatch(frame: Frame, handlers: CaseFeedHandlers, remember: (id: string) => void): void {
  try {
    const payload: unknown = JSON.parse(frame.data)
    if (frame.event === 'ready') {
      handlers.onReady(caseFeedReadySchema.parse(payload))
    } else if (frame.event === 'update') {
      const update = caseFeedUpdateSchema.parse(payload)
      if (frame.id !== undefined) remember(frame.id)
      handlers.onUpdate(update)
    }
  } catch {
    // A frame that does not parse is dropped; the next one is unaffected.
  }
}

import { z } from 'zod'
import { planRouteSchema } from '@contracts/market-plan.ts'

/**
 * The routes to a home a saved comparison carries (2026-11-10, "every route on one screen").
 *
 * The saved-plan card (`contracts/cards.ts`) and the plan preview (`contracts/session.ts`) carry
 * `routes` (saoi `contracts/market-plan.ts`, `planRouteSchema`, synced 2026-11-10). This reads
 * them off either payload with this schema as the boundary: the fields the arrival shows, in the
 * backend's shape. A payload without routes, or with routes that do not parse, shows none.
 */
export { planRouteSchema }
export type PlanRoute = z.infer<typeof planRouteSchema>

const carrier = z.object({ routes: z.array(planRouteSchema) })

/** The routes on a card or preview, in the order given; empty when there are none. */
export function routesOf(payload: unknown): readonly PlanRoute[] {
  const parsed = carrier.safeParse(payload)
  return parsed.success ? parsed.data.routes : []
}

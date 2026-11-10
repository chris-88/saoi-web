import { z } from 'zod'

/**
 * The routes to a home a saved comparison carries (2026-11-10, "every route on one screen").
 *
 * The home calculator's result has `routes[]` (saoi `contracts/market-tools.ts`,
 * `homeRouteSchema`), but neither the saved-plan card (`contracts/cards.ts`) nor the plan
 * preview (`contracts/session.ts`) carries them yet. Until they do, this reads them off either
 * payload when present, with this schema as the boundary: the fields the arrival shows, in the
 * backend's shape. A payload without routes, or with routes that do not parse, shows none.
 * Once the contracts carry `routes`, this reads the synced field the same way.
 */
export const planRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['potential', 'needs_one_detail', 'not_applicable']),
  /** One line, about 90 characters, shown as is. */
  line: z.string(),
  reason: z.string().nullable(),
  missing: z.string().nullable(),
  conditions: z.array(z.string()),
  sources: z.array(z.object({ fact: z.string(), url: z.string(), checkedOn: z.string() })),
})
export type PlanRoute = z.infer<typeof planRouteSchema>

const carrier = z.object({ routes: z.array(planRouteSchema) })

/** The routes on a card or preview, in the order given; empty when there are none. */
export function routesOf(payload: unknown): readonly PlanRoute[] {
  const parsed = carrier.safeParse(payload)
  return parsed.success ? parsed.data.routes : []
}

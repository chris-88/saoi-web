import { adoptPlanLink } from '@/app/planLink'
import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom'
import {
  LazyAsk,
  LazySaoirseScreen,
  LazyPartnerJoin,
  LazyPlanClaim,
  LazyPrivacy,
  LazyYou,
} from '@/app/lazySurfaces'
import {
  AdminRedirect,
  ArticleRedirect,
  HowItWorksRedirect,
  ShowcaseRedirect,
} from '@/app/ExternalRedirect'
import { LegacyChatRedirect } from '@/app/LegacyChatRedirect'
import { NotFound } from '@/components/NotFound'
import { RouteError } from '@/app/RouteError'

const routeObjects: RouteObject[] = [
  { path: '/', element: <LazySaoirseScreen /> },
  // `/baz` is the chat's old address (before the rename to Saoi). Old links and printed QR codes
  // still use it, so it stays as a redirect to the chat.
  { path: '/baz', element: <LegacyChatRedirect /> },

  { path: '/privacy', element: <LazyPrivacy /> },
  // You, and its pages. The avatar in the chat header opens the first; the rows open the rest.
  { path: '/you', element: <LazyYou /> },
  { path: '/you/:section', element: <LazyYou /> },
  { path: '/how-it-works', element: <HowItWorksRedirect /> },
  { path: '/how-it-works/:section', element: <HowItWorksRedirect /> },
  { path: '/showcase', element: <ShowcaseRedirect /> },
  { path: '/article', element: <ArticleRedirect /> },
  { path: '/ask', element: <LazyAsk /> },

  { path: '/join/:token', element: <LazyPartnerJoin /> },

  // A plan made in the customer's own AI, opened once from the link it was saved behind.
  { path: '/plan/:token', element: <LazyPlanClaim /> },

  // The presenter console is its own site now (chris-88/saoi-admin, admin.saoi.ie).
  { path: '/admin/*', element: <AdminRedirect /> },

  /**
   * The authenticated app and the audience entry used to live here.
   *
   * Anyone with the old links — an installed PWA pinned to `/app`, a QR printed on a slide —
   * lands on Saoirse rather than a dead end.
   */
  { path: '/app/*', element: <Navigate to="/" replace /> },
  { path: '/try', element: <Navigate to="/" replace /> },

  { path: '/index.html', element: <Navigate to="/" replace /> },
  { path: '*', element: <NotFound /> },
]

// A saved comparison's `?plan=` link becomes `#/plan/<token>` before the router reads it.
adoptPlanLink(window)

export const router = createHashRouter(
  routeObjects.map((route) => ({ ...route, errorElement: <RouteError /> })),
)

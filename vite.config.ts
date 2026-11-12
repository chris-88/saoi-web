import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // GitHub Pages has no rewrites: `/<repo>/` unless a custom domain is configured.
  const raw = env.VITE_BASE_PATH?.trim() || '/'
  const base = raw.endsWith('/') ? raw : `${raw}/`

  return {
    base,
    resolve: {
      alias: {
        '@': resolve('./src'),
        // shadcn generates `import { cn } from "cn"`; keep ui/ identical to upstream.
        cn: resolve('./src/lib/utils.ts'),
        // Copied from chris-88/saoi by `npm run shared:sync`; see scripts/sync-shared.ts.
        '@domain': resolve('./src/shared/domain'),
        '@contracts': resolve('./src/shared/contracts'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // `start_url`/`scope` follow base so the installed PWA works under /<repo>/.
        manifest: {
          name: 'Saoirse',
          short_name: 'Saoirse',
          description: 'A personal banker for everyone.',
          /**
           * Installed, it opens straight into the conversation.
           *
           * `/` is the conversation now (the marketing landing lives at saoi.ie). `scope` stays
           * at the base so the service worker still covers every route.
           */
          start_url: `${base}#/`,
          scope: base,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#002F32',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          /*
           * The push handlers, added to the generated worker rather than replacing it.
           *
           * `injectManifest` would mean hand-writing the whole service worker, and this one
           * already precaches the shell, sends navigations to the network, never caches the API
           * and cleans up after a deploy. Two event listeners are not worth putting that at risk.
           */
          importScripts: ['push-sw.js'],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Each deploy renames every hashed file, so without this the precache keeps every
          // build it has ever seen and grows until the browser evicts the lot.
          cleanupOutdatedCaches: true,
          /*
           * Navigations go to the network; the precache is the offline fallback only.
           *
           * The default answers every navigation with the precached `index.html`, cache-first,
           * so a page open never sees a newer shell: the only way onto a new build is for the
           * new worker to finish installing (about 1.5 MB) while the page is open. An in-app
           * browser sheet closed within seconds never lets it, and opened on a build four
           * deploys old (2026-11-12). So no `NavigationRoute`, and no `directoryIndex` either,
           * which would let the precache route answer `/` with `index.html` before the
           * navigation rule below is reached.
           *
           * The fresh `index.html` names hashed files this worker has not precached; the precache
           * route answers only the URLs it holds, so those go to the network untouched.
           * `scripts/check-service-worker.ts` checks the built worker keeps to this.
           */
          navigateFallback: null,
          directoryIndex: null,
          runtimeCaching: [
            {
              /*
               * `NetworkOnly` with the precached shell behind it, not `NetworkFirst` with a
               * timeout. `NetworkFirst` keeps its own copy of the last `index.html` fetched and
               * serves it on the timeout; a copy from a build the server has since replaced names
               * chunks that now 404, which is a blank page. The precached shell is always the one
               * whose chunks this worker holds. Workbox allows a timeout on `NetworkFirst` only,
               * so a slow network is waited for, as it would be with no worker at all; a failed
               * one (offline) gets the shell at once.
               */
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkOnly',
              options: {
                precacheFallback: { fallbackURL: `${base}index.html` },
              },
            },
            // Never cache API responses (CLAUDE.md > GitHub Pages). Requests to saoi-api match
            // no route at all, which also means the network, uncached.
            {
              urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      sourcemap: true,
      target: 'es2023',
    },
    server: {
      port: 5173,
    },
  }
})

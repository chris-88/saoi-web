# saoi-web

The Saoirse chat, live at [app.saoi.ie](https://app.saoi.ie). Saoi is a conversational
orchestration layer over simulated retail banking product journeys for a fictional Demo Bank;
Saoirse is its assistant. This repo is the customer's app: the conversation, the partner join
page, questions and the privacy notice. It is a proof of concept, not a bank: nothing in it is
real.

| Repo                                                                | What                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| [chris-88/saoi](https://github.com/chris-88/saoi)                   | the backend (`saoi-api`, schema, domain) and the product docs |
| [chris-88/saoi-admin](https://github.com/chris-88/saoi-admin)       | the presenter console, [admin.saoi.ie](https://admin.saoi.ie) |
| [chris-88/saoi-showcase](https://github.com/chris-88/saoi-showcase) | the showcase, [showcase.saoi.ie](https://showcase.saoi.ie)    |

## Setup

Node 24 (`.nvmrc`) and npm. The app talks to a running `saoi-api`; the public one at
`https://api.saoi.ie` works for local development of the UI.

```sh
git clone https://github.com/chris-88/saoi-web.git
cd saoi-web
nvm use
npm ci
cp .env.example .env     # fill in the VITE_* values; none of them is secret
npm run dev
```

## Commands

| Command                               | What it does                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`                       | The pre-merge gate: typecheck, lint, format check, test, build, bundle scans         |
| `npm run dev`                         | Vite dev server on 5173                                                              |
| `npm test`                            | Vitest                                                                               |
| `npm run e2e`                         | Playwright route and render checks                                                   |
| `npm run api:generate`                | Regenerate the typed API client's schema from `https://api.saoi.ie/api/openapi.json` |
| `npm run shared:sync`, `shared:check` | Refresh, or check, the contracts copied from `../saoi`                               |

## Licence

AGPL-3.0-only. See [LICENSE](LICENSE).

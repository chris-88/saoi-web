/**
 * Copies the shared contracts and domain files this app uses from a `chris-88/saoi` checkout.
 *
 * `src/shared/` is a copy, not a package: the backend owns these files
 * (`supabase/functions/_shared/` in `chris-88/saoi`) and this app takes the ones it imports.
 * The list below is exactly those, so a new import of a shared file is added here too.
 *
 *   npm run shared:sync              # copy from ../saoi (or SAOI_DIR)
 *   npm run shared:check             # exit 1 if any copy differs from the checkout
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const FILES = [
  'contracts/alerts.ts',
  'contracts/cards.ts',
  'contracts/case-action.ts',
  'contracts/case-read.ts',
  'contracts/common.ts',
  'contracts/market-plan.ts',
  'contracts/partner.ts',
  'contracts/session.ts',
  'contracts/stream.ts',
  'domain/card-state.ts',
  'domain/facts.ts',
  'domain/journey.ts',
  'domain/state-machine.ts',
] as const

const saoi = resolve(process.env.SAOI_DIR ?? '../saoi')
const source = join(saoi, 'supabase/functions/_shared')
const target = resolve('src/shared')
const check = process.argv.includes('check')

if (!existsSync(source)) {
  console.error(`No ${source}. Set SAOI_DIR to a chris-88/saoi checkout.`)
  process.exit(1)
}

let drift = 0
for (const file of FILES) {
  const from = join(source, file)
  const to = join(target, file)
  if (check) {
    const same = existsSync(to) && readFileSync(from, 'utf8') === readFileSync(to, 'utf8')
    if (!same) {
      console.error(`differs: src/shared/${file}`)
      drift++
    }
  } else {
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
  }
}

if (check && drift > 0) process.exit(1)
console.log(check ? 'src/shared matches the saoi checkout.' : `Copied ${FILES.length} files.`)

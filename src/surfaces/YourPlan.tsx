import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, FolderOpen, IdCard, Pencil, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { IconTile } from '@/components/IconTile'
import { useCasePlan, useUpdateCasePlan } from '@/api/plan'
import {
  PROPERTY_KIND_LABELS,
  PROPERTY_KINDS,
  currentMonth,
  eur,
  keysMonth,
  monthLabel,
  isHomePlan,
  type PlanField,
  type PropertyKind,
} from '@/lib/plan'
import type { CasePlan, CasePlanEdit, PlanEditable } from '@contracts/case-plan.ts'
import { handSaoirseLine } from '@/lib/planArrival'
import { routes } from '@/app/routes'
import { Group, GroupLabel, LinkRow, rowClass } from '@/surfaces/YouRows'

/**
 * Your plan (2026-11-12, build 4 of the first-home experience): the plan between
 * conversations.
 *
 * The goal and the keys month first and large, saved against needed under them, then the plan's
 * own figures, each editable in place, one at a time. An edit does not end here: the server
 * recomputes the plan and says in one sentence what changed, and the chat opens on that
 * sentence as Saoirse's, then reads what now fits. Below the figures, the options being watched,
 * the way to the balances (edited where they already are, in Your money), and the places for
 * what the app will hold later, greyed until they are live.
 */
export function PlanSection({ caseId }: { readonly caseId: string }): ReactNode {
  const plan = useCasePlan(caseId)

  if (plan.isPending) return <p className="text-muted-foreground text-sm">Looking it up…</p>
  if (plan.isError) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">Your plan would not load. {plan.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void plan.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (plan.data === null) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          No saved plan in this conversation yet. A plan made with Saoirse, or opened from a link,
          is kept here.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={routes.saoirse}>Go to Saoirse</Link>
        </Button>
      </div>
    )
  }
  return <PlanBody caseId={caseId} plan={plan.data} />
}

function PlanBody({ caseId, plan }: { readonly caseId: string; readonly plan: CasePlan }) {
  return (
    <div className="space-y-6">
      <Summary plan={plan} />
      <div>
        <GroupLabel>The plan</GroupLabel>
        <EditableRows caseId={caseId} plan={plan} />
      </div>
      <Watched watched={plan.watched} />
      <Group>
        <LinkRow
          to={routes.youSection('money')}
          icon={<Wallet />}
          label="Balances and debts"
          detail="Changed in Your money"
        />
      </Group>
      <Coming />
    </div>
  )
}

/** The goal and the keys month, large; saved against needed, with the plan's own line. */
function Summary({ plan }: { readonly plan: CasePlan }): ReactNode {
  const keys = keysMonth(plan)
  const home = isHomePlan(plan)
  const { savedEur, neededAtKeysEur, progressLine } = plan.summary
  return (
    <section aria-label="Where the plan stands" className="bg-card rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-sm font-medium">{plan.title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {keys === null
          ? home
            ? 'No keys month yet'
            : 'No month set yet'
          : `${home ? 'Keys' : 'By'} ${monthLabel(keys)}`}
      </p>
      {savedEur !== null && neededAtKeysEur !== null && (
        <Meter saved={savedEur} needed={neededAtKeysEur} />
      )}
      {progressLine !== null && (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{progressLine}</p>
      )}
    </section>
  )
}

function Meter({ saved, needed }: { readonly saved: number; readonly needed: number }): ReactNode {
  const pct = needed <= 0 || saved >= needed ? 100 : Math.round((saved / needed) * 1000) / 10
  return (
    <div className="mt-4 space-y-1.5">
      <div
        role="progressbar"
        aria-label="Saved towards the money needed at the keys"
        aria-valuemin={0}
        aria-valuemax={Math.round(needed)}
        aria-valuenow={Math.round(Math.min(saved, needed))}
        className="bg-muted h-1.5 overflow-hidden rounded-full"
      >
        <span
          className="bg-primary block h-full rounded-full"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{eur(saved)}</span>
        <span className="text-muted-foreground"> of {eur(needed)} saved</span>
      </p>
    </div>
  )
}

const FIELDS = [
  'targetDate',
  'homePrice',
  'monthlySaving',
  'propertyKind',
  'firstTimeBuyer',
  'buyingTogether',
] as const satisfies readonly PlanField[]

/** A plan that is not for a home has no price or kind (the server refuses them) and no buyers. */
const HOME_ONLY: ReadonlySet<PlanField> = new Set([
  'homePrice',
  'propertyKind',
  'firstTimeBuyer',
  'buyingTogether',
])

const FIELD_LABELS = {
  targetDate: 'Date you gave',
  homePrice: 'Price of the home',
  monthlySaving: 'Saved each month',
  propertyKind: 'Kind of home',
  firstTimeBuyer: 'First-time buyer',
  buyingTogether: 'Buying together',
} as const satisfies Record<PlanField, string>

/** The date the customer gave; "Goal month" when the plan is not for a home. */
const labelOf = (field: PlanField, home: boolean): string =>
  field === 'targetDate' && !home ? 'Goal month' : FIELD_LABELS[field]

const DATE_HINT =
  'The month you are aiming for. The keys month above is when the money is there at this pace.'

const NOT_SET = 'Not set'
const yesNo = (value: boolean | null): string => (value === null ? NOT_SET : value ? 'Yes' : 'No')

function shown(field: PlanField, editable: PlanEditable): string {
  switch (field) {
    case 'targetDate':
      return editable.targetDate === null ? NOT_SET : monthLabel(editable.targetDate)
    case 'homePrice':
      return editable.homePrice === null ? NOT_SET : eur(editable.homePrice)
    case 'monthlySaving':
      return editable.monthlySaving === null ? NOT_SET : eur(editable.monthlySaving)
    case 'propertyKind':
      return editable.propertyKind === null ? NOT_SET : PROPERTY_KIND_LABELS[editable.propertyKind]
    case 'firstTimeBuyer':
      return yesNo(editable.firstTimeBuyer)
    case 'buyingTogether':
      return yesNo(editable.buyingTogether)
  }
}

/**
 * The plan's own figures, one row each. Tapping a row opens it in place; one is open at a time.
 * A save that changes nothing closes the row without a request. A save that does change
 * something goes to the server, and the chat opens on Saoirse's reading of it.
 *
 * What the server can still say (saoi `routes/plans/case-plan.ts`):
 * - 200 with "Nothing changed: the plan already has these figures." and the plan as it was
 *   (same `updatedAt`, no `plan_edited` event): nothing for the chat to read, so the row closes.
 * - 400 for a month that has passed, a figure of zero or less, an unknown key, or a price or kind
 *   on a plan that is not for a home. The editors refuse the first two before sending, never send
 *   an unknown key, and a non-home plan has no price or kind row; what is left (the month turning
 *   over in Dublin before it does here) shows the server's sentence in the open row.
 * - 404 when the plan has gone: the plan is read again, and the page says there is none.
 */
function EditableRows({ caseId, plan }: { readonly caseId: string; readonly plan: CasePlan }) {
  const navigate = useNavigate()
  const update = useUpdateCasePlan(caseId)
  const [editing, setEditing] = useState<PlanField | null>(null)
  const rows = useRef<Partial<Record<PlanField, HTMLButtonElement | null>>>({})
  /** The row whose editor just closed, which gets the focus back. */
  const [returnFocus, setReturnFocus] = useState<PlanField | null>(null)

  useEffect(() => {
    if (returnFocus === null) return
    rows.current[returnFocus]?.focus()
  }, [returnFocus])

  const open = (field: PlanField): void => {
    update.reset()
    setReturnFocus(null)
    setEditing(field)
  }
  const close = (): void => {
    update.reset()
    setReturnFocus(editing)
    setEditing(null)
  }

  const home = isHomePlan(plan)
  const fields = FIELDS.filter((field) => home || !HOME_ONLY.has(field))

  const save = (body: CasePlanEdit): void => {
    const keys = Object.keys(body) as PlanField[]
    if (keys.every((key) => body[key] === plan.editable[key])) {
      close()
      return
    }
    update.mutate(body, {
      onSuccess: (edited) => {
        if (edited.updatedAt === plan.updatedAt) {
          close()
          return
        }
        handSaoirseLine(edited.reading)
        void navigate(routes.saoirse)
      },
    })
  }

  const editor = (field: PlanField): ReactNode => {
    const common = {
      label: labelOf(field, home),
      pending: update.isPending,
      error: update.isError ? `That was not saved. ${update.error.message}` : null,
      onCancel: close,
    }
    const { editable } = plan
    switch (field) {
      case 'targetDate':
        return (
          <MonthEditor
            {...common}
            initial={editable.targetDate}
            hint={home ? DATE_HINT : null}
            onSave={(value) => save({ targetDate: value })}
          />
        )
      case 'homePrice':
        return (
          <EuroEditor
            {...common}
            initial={editable.homePrice}
            zeroMessage="Enter a price above €0."
            onSave={(value) => save({ homePrice: value })}
          />
        )
      case 'monthlySaving':
        return (
          <EuroEditor
            {...common}
            initial={editable.monthlySaving}
            zeroMessage="Enter an amount above €0."
            onSave={(value) => save({ monthlySaving: value })}
          />
        )
      case 'propertyKind':
        return (
          <KindEditor
            {...common}
            initial={editable.propertyKind}
            onSave={(value) => save({ propertyKind: value })}
          />
        )
      case 'firstTimeBuyer':
        return (
          <SwitchEditor
            {...common}
            initial={editable.firstTimeBuyer}
            onSave={(value) => save({ firstTimeBuyer: value })}
          />
        )
      case 'buyingTogether':
        return (
          <SwitchEditor
            {...common}
            initial={editable.buyingTogether}
            onSave={(value) => save({ buyingTogether: value })}
          />
        )
    }
  }

  return (
    <Group>
      {fields.map((field) =>
        editing === field ? (
          <div key={field} className="bg-muted/40 p-3">
            {editor(field)}
          </div>
        ) : (
          <button
            key={field}
            ref={(element) => {
              rows.current[field] = element
            }}
            type="button"
            className={rowClass}
            aria-label={`${labelOf(field, home)}: ${shown(field, plan.editable)}. Change`}
            onClick={() => open(field)}
          >
            <span className="min-w-0 flex-1 text-sm font-medium">{labelOf(field, home)}</span>
            <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
              {shown(field, plan.editable)}
            </span>
            <Pencil className="text-muted-foreground/60 size-3.5 shrink-0" aria-hidden />
          </button>
        ),
      )}
    </Group>
  )
}

type EditorProps<T> = {
  readonly label: string
  readonly initial: T | null
  readonly pending: boolean
  readonly error: string | null
  readonly onSave: (value: T) => void
  readonly onCancel: () => void
}

/** Save and Cancel, and what went wrong with the last save. */
function Actions({
  pending,
  error,
  onCancel,
}: Pick<EditorProps<unknown>, 'pending' | 'error' | 'onCancel'>): ReactNode {
  return (
    <>
      {error !== null && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  )
}

const monthSchema = z.object({
  value: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Enter a month, such as 2028-03.')
    .refine((value) => value >= currentMonth(), 'Choose this month or a later one.'),
})

function MonthEditor({
  label,
  initial,
  hint,
  onSave,
  ...actions
}: EditorProps<string> & { readonly hint: string | null }): ReactNode {
  const form = useForm({
    resolver: zodResolver(monthSchema),
    defaultValues: { value: initial ?? '' },
  })
  const { setFocus } = form
  useEffect(() => setFocus('value'), [setFocus])
  return (
    <Form {...form}>
      <form
        className="space-y-3"
        noValidate
        onSubmit={(event) => void form.handleSubmit(({ value }) => onSave(value))(event)}
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Input type="month" min={currentMonth()} placeholder="YYYY-MM" {...field} />
              </FormControl>
              {hint !== null && <FormDescription>{hint}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <Actions {...actions} />
      </form>
    </Form>
  )
}

const MAX_EURO = 100_000_000

/** A euro amount as typed: "350,000", "€350000" and "350000" are the same. */
const euroNumber = (typed: string): number => Number(typed.replace(/[€,\s]/g, ''))

/** Above zero, as the server holds every amount (`positive()`), and within its ceiling. */
const euroSchema = (zeroMessage: string) =>
  z.object({
    value: z
      .string()
      .trim()
      .refine(
        (value) => /^\d+(\.\d{1,2})?$/.test(value.replace(/[€,\s]/g, '')),
        'Enter an amount in euro.',
      )
      .refine((value) => euroNumber(value) > 0, zeroMessage)
      .refine((value) => euroNumber(value) <= MAX_EURO, 'That is more than Saoi can work with.'),
  })

function EuroEditor({
  label,
  initial,
  zeroMessage,
  onSave,
  ...actions
}: EditorProps<number> & { readonly zeroMessage: string }): ReactNode {
  const form = useForm({
    resolver: zodResolver(euroSchema(zeroMessage)),
    defaultValues: { value: initial === null ? '' : String(initial) },
  })
  const { setFocus } = form
  useEffect(() => setFocus('value'), [setFocus])
  return (
    <Form {...form}>
      <form
        className="space-y-3"
        noValidate
        onSubmit={(event) =>
          void form.handleSubmit(({ value }) => onSave(euroNumber(value)))(event)
        }
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label} (€)</FormLabel>
              <FormControl>
                <Input inputMode="decimal" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Actions {...actions} />
      </form>
    </Form>
  )
}

const isPropertyKind = (value: string): value is PropertyKind =>
  (PROPERTY_KINDS as readonly string[]).includes(value)

const kindSchema = z.object({ value: z.string().refine(isPropertyKind, 'Choose one.') })

function KindEditor({ label, initial, onSave, ...actions }: EditorProps<PropertyKind>): ReactNode {
  // Blank until chosen when the plan has none; the schema refuses blank.
  const form = useForm({
    resolver: zodResolver(kindSchema),
    defaultValues: { value: initial ?? '' },
  })
  return (
    <Form {...form}>
      <form
        className="space-y-3"
        noValidate
        onSubmit={(event) =>
          void form.handleSubmit(({ value }) => {
            if (isPropertyKind(value)) onSave(value)
          })(event)
        }
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="w-full"
                  value={field.value}
                  onValueChange={(next) => {
                    // Radix clears to '' on a second tap; a kind of home stays chosen.
                    if (next !== '') field.onChange(next)
                  }}
                >
                  {PROPERTY_KINDS.map((kind) => (
                    <ToggleGroupItem key={kind} value={kind} className="flex-1">
                      {PROPERTY_KIND_LABELS[kind]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Actions {...actions} />
      </form>
    </Form>
  )
}

const switchSchema = z.object({ value: z.boolean() })

function SwitchEditor({ label, initial, onSave, ...actions }: EditorProps<boolean>): ReactNode {
  const form = useForm({
    resolver: zodResolver(switchSchema),
    defaultValues: { value: initial ?? false },
  })
  const { setFocus } = form
  useEffect(() => setFocus('value'), [setFocus])
  return (
    <Form {...form}>
      <form
        className="space-y-3"
        noValidate
        onSubmit={(event) => void form.handleSubmit(({ value }) => onSave(value))(event)}
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-3">
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Switch
                  ref={field.ref}
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Actions {...actions} />
      </form>
    </Form>
  )
}

/** The plan's top options, in the row style of the product cards. */
function Watched({ watched }: { readonly watched: CasePlan['watched'] }): ReactNode {
  return (
    <div>
      <GroupLabel>Options you are watching</GroupLabel>
      <Group>
        {watched.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-xs leading-relaxed">
            No options saved with this plan yet.
          </p>
        ) : (
          <ol className="divide-y px-4" aria-label="Options you are watching">
            {watched.map((row) => (
              <li
                key={`${row.lead}-${row.kind}`}
                className="flex items-baseline justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{row.lead}</span>{' '}
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      · {row.kind}
                    </span>
                  </p>
                  <p className="text-foreground/75 mt-0.5 text-xs leading-snug tabular-nums">
                    {row.figure}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
                  {row.value}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Group>
    </div>
  )
}

const COMING = [
  { label: 'Statements', icon: <FileText /> },
  { label: 'ID and proof of address', icon: <IdCard /> },
  { label: 'Application pack', icon: <FolderOpen /> },
] as const

/** Where the app is going: the places for what it will hold later, greyed until they are live. */
function Coming(): ReactNode {
  return (
    <div>
      <GroupLabel>Coming</GroupLabel>
      <Group>
        <ul className="divide-y" aria-label="Coming">
          {COMING.map(({ label, icon }) => (
            <li
              key={label}
              aria-disabled="true"
              className="flex items-center gap-3 px-3 py-3 opacity-60"
            >
              <IconTile tone="neutral" size="sm">
                {icon}
              </IconTile>
              <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
              <span className="text-muted-foreground shrink-0 text-xs">Not yet</span>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  )
}

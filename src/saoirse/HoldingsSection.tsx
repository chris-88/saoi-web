import { useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import {
  HOLDING_ASSET_KINDS,
  HOLDING_DEBT_KINDS,
  HOLDING_KINDS,
  isAssetKind,
  type CreateHoldingBody,
  type Holding,
  type HoldingKind,
  type UpdateHoldingBody,
} from '@contracts/holdings.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCaseHoldings,
  useCreateHolding,
  useDeleteHolding,
  useUpdateHolding,
} from '@/api/holdings'

export const NO_HOLDINGS = 'Nothing entered yet. Tell Saoirse what you have, or add it here.'

const KIND_LABELS = {
  current: 'Current account',
  savings: 'Savings account',
  deposit: 'Fixed-term deposit',
  credit_card: 'Credit card',
  personal_loan: 'Personal loan',
  car_finance: 'Car finance',
  overdraft: 'Overdraft',
  mortgage: 'Mortgage',
  other_debt: 'Other debt',
} as const satisfies Record<HoldingKind, string>

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** "1 Mar 2027" for a calendar day (YYYY-MM-DD, no time zone). */
function day(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "3.1% · fixed until 1 Mar 2027 · as of 11 Nov 2026": only what was given. */
function details(holding: Holding): string {
  return [
    holding.ratePct === null ? null : `${String(holding.ratePct)}%`,
    holding.fixedUntil === null ? null : `fixed until ${day(holding.fixedUntil)}`,
    `as of ${day(holding.notedOn)}`,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

/** An optional number typed into a field: blank is "not given". */
const optionalNumber = (max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message,
    })
    .refine((value) => value === '' || Number(value) <= max, { message })

const formSchema = z.object({
  kind: z.enum(HOLDING_KINDS),
  label: z
    .string()
    .trim()
    .min(1, 'Give it a name, such as “BoI savings”.')
    .max(80, 'Up to 80 characters.'),
  balance: z
    .string()
    .trim()
    .min(1, 'Enter the balance in euro.')
    .pipe(optionalNumber(9_999_999_999.99, 'Enter the balance in euro.')),
  ratePct: optionalNumber(100, 'A rate between 0 and 100.'),
  monthlyAmountEur: optionalNumber(9_999_999_999.99, 'Enter an amount in euro.'),
  fixedUntil: z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Enter a date.'),
})
type FormValues = z.infer<typeof formSchema>

const blank: FormValues = {
  kind: 'savings',
  label: '',
  balance: '',
  ratePct: '',
  monthlyAmountEur: '',
  fixedUntil: '',
}

function valuesOf(holding: Holding): FormValues {
  return {
    kind: holding.kind,
    label: holding.label,
    balance: String(holding.balance),
    ratePct: holding.ratePct === null ? '' : String(holding.ratePct),
    monthlyAmountEur: holding.monthlyAmountEur === null ? '' : String(holding.monthlyAmountEur),
    fixedUntil: holding.fixedUntil ?? '',
  }
}

const numberOrNull = (value: string): number | null => (value === '' ? null : Number(value))

/** A new holding: blanks left out. */
function createBody(values: FormValues): CreateHoldingBody {
  const rate = numberOrNull(values.ratePct)
  const monthly = numberOrNull(values.monthlyAmountEur)
  return {
    kind: values.kind,
    label: values.label,
    balance: Number(values.balance),
    ...(rate === null ? {} : { ratePct: rate }),
    ...(monthly === null ? {} : { monthlyAmountEur: monthly }),
    ...(values.fixedUntil === '' ? {} : { fixedUntil: values.fixedUntil }),
  }
}

/**
 * Only what changed, so an untouched balance keeps its "as of" day; a field emptied is sent
 * as null, which clears it.
 */
function updateBody(holding: Holding, values: FormValues): UpdateHoldingBody {
  const body: UpdateHoldingBody = {}
  const rate = numberOrNull(values.ratePct)
  const monthly = numberOrNull(values.monthlyAmountEur)
  const fixedUntil = values.fixedUntil === '' ? null : values.fixedUntil
  if (values.kind !== holding.kind) body.kind = values.kind
  if (values.label !== holding.label) body.label = values.label
  if (Number(values.balance) !== holding.balance) body.balance = Number(values.balance)
  if (rate !== holding.ratePct) body.ratePct = rate
  if (monthly !== holding.monthlyAmountEur) body.monthlyAmountEur = monthly
  if (fixedUntil !== holding.fixedUntil) body.fixedUntil = fixedUntil
  return body
}

function HoldingForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: FormValues
  submitLabel: string
  pending: boolean
  error: string | null
  onSubmit: (values: FormValues) => void
  onCancel: () => void
}): ReactNode {
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: initial })
  const kind = useWatch({ control: form.control, name: 'kind' })
  const asset = isAssetKind(kind)

  return (
    <Form {...form}>
      <form
        className="bg-muted/50 space-y-3 rounded-md p-3"
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What it is</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Saved</SelectLabel>
                    {HOLDING_ASSET_KINDS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {KIND_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Owed</SelectLabel>
                    {HOLDING_DEBT_KINDS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {KIND_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input maxLength={80} autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{asset ? 'Balance (€)' : 'Owed (€)'}</FormLabel>
              <FormControl>
                <Input inputMode="decimal" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="ratePct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate (%)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="monthlyAmountEur"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{asset ? 'In each month (€)' : 'Repaid each month (€)'}</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="fixedUntil"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fixed until</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error !== null && <p className="text-destructive text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}

function HoldingRow({
  holding,
  onEdit,
  onDelete,
  deleting,
}: {
  holding: Holding
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}): ReactNode {
  return (
    <li className="bg-muted/50 flex items-center gap-1 rounded-md py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{holding.label}</span>
          <span className="shrink-0 text-sm tabular-nums">{euro.format(holding.balance)}</span>
        </span>
        <span className="text-muted-foreground block text-xs">{details(holding)}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground shrink-0"
        aria-label={`Edit ${holding.label}`}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground shrink-0"
        aria-label={`Delete ${holding.label}`}
        disabled={deleting}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}

/**
 * The menu's "Your money" section (holdings, 2026-11-11): the accounts and debts entered by hand
 * or by Saoirse, grouped as saved and owed, each editable and deletable, and where that leaves
 * the plan in the server's one line. Facts only: nothing here praises or nudges.
 */
export function HoldingsSection({
  caseId,
  enabled,
}: {
  caseId: string
  enabled: boolean
}): ReactNode {
  const holdings = useCaseHoldings(caseId, { enabled })
  const create = useCreateHolding(caseId)
  const update = useUpdateHolding(caseId)
  const remove = useDeleteHolding(caseId)
  /** `'new'` while adding, a holding's id while editing it, null otherwise. */
  const [editing, setEditing] = useState<string | null>(null)

  const close = (): void => {
    setEditing(null)
    create.reset()
    update.reset()
  }

  const group = (title: string, rows: readonly Holding[]): ReactNode =>
    rows.length === 0 ? null : (
      <div>
        <h4 className="text-muted-foreground mb-1.5 text-xs font-medium">{title}</h4>
        <ul className="space-y-2" aria-label={title}>
          {rows.map((holding) =>
            editing === holding.id ? (
              <li key={holding.id}>
                <HoldingForm
                  initial={valuesOf(holding)}
                  submitLabel="Save"
                  pending={update.isPending}
                  error={update.isError ? `That was not saved. ${update.error.message}` : null}
                  onCancel={close}
                  onSubmit={(values) => {
                    const body = updateBody(holding, values)
                    if (Object.keys(body).length === 0) {
                      close()
                      return
                    }
                    update.mutate({ holdingId: holding.id, body }, { onSuccess: close })
                  }}
                />
              </li>
            ) : (
              <HoldingRow
                key={holding.id}
                holding={holding}
                onEdit={() => {
                  close()
                  setEditing(holding.id)
                }}
                onDelete={() => remove.mutate(holding.id)}
                deleting={remove.isPending && remove.variables === holding.id}
              />
            ),
          )}
        </ul>
      </div>
    )

  return (
    <section className="p-4" aria-labelledby="holdings-heading">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          id="holdings-heading"
          className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase"
        >
          <Wallet className="size-3.5" />
          Your money
        </h3>
        {holdings.isSuccess && editing !== 'new' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              close()
              setEditing('new')
            }}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        )}
      </div>

      {holdings.isPending ? (
        <p className="text-muted-foreground text-xs">Looking them up…</p>
      ) : holdings.isError ? (
        <div className="space-y-2">
          <p className="text-destructive text-xs">
            Your accounts and debts would not load. {holdings.error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => void holdings.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {holdings.data.progress !== null && (
            <p className="text-sm leading-relaxed">{holdings.data.progress.line}</p>
          )}

          {editing === 'new' && (
            <HoldingForm
              initial={blank}
              submitLabel="Add"
              pending={create.isPending}
              error={create.isError ? `That was not added. ${create.error.message}` : null}
              onCancel={close}
              onSubmit={(values) => create.mutate(createBody(values), { onSuccess: close })}
            />
          )}

          {holdings.data.holdings.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">{NO_HOLDINGS}</p>
          ) : (
            <>
              {group(
                'Saved',
                holdings.data.holdings.filter((holding) => isAssetKind(holding.kind)),
              )}
              {group(
                'Owed',
                holdings.data.holdings.filter((holding) => !isAssetKind(holding.kind)),
              )}
            </>
          )}

          {remove.isError && (
            <p className="text-destructive text-xs">That was not deleted. {remove.error.message}</p>
          )}
        </div>
      )}
    </section>
  )
}

import type { ReactNode } from 'react'
import { CalendarClock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCaseAlerts, useDeleteReminder } from '@/api/alerts'

/** How many alerts the menu shows; the rest are Saoirse's to mention. */
const RECENT_ALERTS = 5

export const NO_REMINDERS = 'No reminders yet. Tell Saoirse a date, or tap a chip.'

/** "1 Mar 2027" for a day the customer gave (YYYY-MM-DD, a calendar day, no time zone). */
function day(dueOn: string): string {
  return new Date(`${dueOn}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "11 Nov 2026" for the moment an alert was raised, on the Irish calendar. */
function raisedOn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  })
}

/**
 * The menu's "Reminders" section (plan alerts, 2026-11-11): the dates the customer gave, each
 * with a way to delete it, and the latest alerts about the plan, read-only. Facts with a date;
 * nothing here suggests what to do about them.
 *
 * Reading the list marks the alerts seen on the server, so it is read only while the menu is
 * open (`enabled`).
 */
export function RemindersSection({
  caseId,
  enabled,
  heading = true,
}: {
  caseId: string
  enabled: boolean
  /** Off when the page around it already says "Reminders". */
  heading?: boolean
}): ReactNode {
  const alerts = useCaseAlerts(caseId, { enabled })
  const remove = useDeleteReminder(caseId)

  return (
    <section
      className={heading ? 'p-4' : undefined}
      {...(heading ? { 'aria-labelledby': 'reminders-heading' } : { 'aria-label': 'Reminders' })}
    >
      {heading && (
        <h3
          id="reminders-heading"
          className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase"
        >
          <CalendarClock className="size-3.5" />
          Reminders
        </h3>
      )}

      {alerts.isPending ? (
        <p className="text-muted-foreground text-xs">Looking them up…</p>
      ) : alerts.isError ? (
        <div className="space-y-2">
          <p className="text-destructive text-xs">
            Your reminders would not load. {alerts.error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => void alerts.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {alerts.data.reminders.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">{NO_REMINDERS}</p>
          ) : (
            <ul className="space-y-2" aria-label="Your reminders">
              {alerts.data.reminders.map((reminder) => (
                <li
                  key={reminder.id}
                  className="bg-muted/50 flex items-center gap-2 rounded-md py-1.5 pr-1.5 pl-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{reminder.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {day(reminder.dueOn)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground shrink-0"
                    aria-label={`Delete the reminder for ${reminder.label}, ${day(reminder.dueOn)}`}
                    disabled={remove.isPending && remove.variables === reminder.id}
                    onClick={() => remove.mutate(reminder.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {remove.isError && (
            <p className="text-destructive mt-2 text-xs">
              That reminder was not deleted. {remove.error.message}
            </p>
          )}

          {alerts.data.alerts.length > 0 && (
            <>
              <h4 className="text-muted-foreground mt-4 mb-2 text-xs font-medium">Latest alerts</h4>
              <ul className="space-y-2" aria-label="Latest alerts">
                {alerts.data.alerts.slice(0, RECENT_ALERTS).map((alert) => (
                  <li key={alert.id} className="bg-muted/50 rounded-md px-3 py-2">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {alert.body}
                    </p>
                    <p className="text-muted-foreground/70 mt-1 text-[11px]">
                      {raisedOn(alert.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}

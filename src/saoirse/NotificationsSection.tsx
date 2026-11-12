import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/queryKeys'
import { PUSH_PROMPT_LINE, pushPermission, subscribeToPush, type SubscribeResult } from '@/lib/push'
import { InstallSteps } from '@/saoirse/InstallSteps'
import { isInstalled, platform } from '@/lib/installed'
import { supabase } from '@/lib/supabase'
import { useNotifications } from '@/api/snapshot'
import { when } from '@/lib/when'
import { cn } from '@/lib/utils'

export const NO_NOTIFICATIONS = 'Nothing yet. Saoirse will tell you here when something moves.'

/** What to say about a subscription attempt, in the customer's terms rather than the API's. */
function subscribeMessage(result: SubscribeResult): string {
  switch (result.state) {
    case 'subscribed':
      return 'This device is registered. Saoirse can reach you here.'
    case 'denied':
      return 'Your browser refused. Nothing will be sent until you allow it for this site.'
    case 'unsupported':
      return result.reason
    case 'failed':
      return result.reason
  }
}

/**
 * The "Notifications" page under You: what Saoirse has sent, newest first, and the way to have
 * this device hear about the next one.
 */
export function NotificationsSection({ caseId }: { caseId: string | null }): ReactNode {
  const queryClient = useQueryClient()
  const notifications = useNotifications(caseId)
  const [permission, setPermission] = useState(() => pushPermission())

  const enablePush = useMutation({
    mutationFn: async () => {
      if (!caseId) return
      const result = await subscribeToPush(caseId)
      setPermission(pushPermission())
      return result
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.case.events(caseId ?? 'none') })
    },
  })

  return (
    <div className="space-y-4">
      {notifications.isPending && caseId !== null && supabase !== null ? (
        <p className="text-muted-foreground text-sm">Looking them up…</p>
      ) : notifications.isError ? (
        <div className="space-y-2">
          <p className="text-destructive text-sm">
            Your notifications would not load. {notifications.error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => void notifications.refetch()}>
            Try again
          </Button>
        </div>
      ) : notifications.data !== undefined && notifications.data.length > 0 ? (
        <ul className="space-y-2" aria-label="Notifications">
          {notifications.data.map((item) => (
            <li key={item.id} className="bg-card rounded-lg border px-3 py-2.5 shadow-xs">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{item.body}</p>
              <p className="text-muted-foreground/70 mt-1 text-[11px]">{when(item.at)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed">{NO_NOTIFICATIONS}</p>
      )}

      {/*
        Offered even when the browser has already granted it.

        It used to hide itself on `granted`, which is the one state where somebody most
        needs it: the permission lives in the browser and the subscription lives on the
        server, and when the server's copy goes — a purge, a reset, a different case —
        the phone still says yes and there is no way left to tell the server so. A
        notification sent to a real phone went nowhere for exactly that reason.
      */}
      {permission !== 'unsupported' && (
        <div className="bg-card rounded-lg border p-4 shadow-xs">
          <p className="text-sm font-medium">On this device</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{PUSH_PROMPT_LINE}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            disabled={enablePush.isPending || caseId === null || permission === 'denied'}
            onClick={() => enablePush.mutate()}
          >
            <BellRing className="size-4" />
            {permission === 'denied'
              ? 'Notifications are blocked'
              : permission === 'granted'
                ? 'Check this device is registered'
                : 'Tell me when things move'}
          </Button>

          {/* What actually happened. Silence here is how the last one was missed. */}
          {enablePush.data !== undefined &&
            (enablePush.data.state === 'unsupported' && platform() === 'ios' && !isInstalled() ? (
              <div className="-mx-4 mt-3 border-t">
                <InstallSteps lead="Notifications need Saoirse on your home screen first. Two taps:" />
              </div>
            ) : (
              <p
                className={cn(
                  'mt-2 text-xs leading-relaxed',
                  enablePush.data.state === 'subscribed' ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {subscribeMessage(enablePush.data)}
              </p>
            ))}
          {enablePush.isError && (
            <p className="text-destructive mt-2 text-xs">{enablePush.error.message}</p>
          )}

          {permission === 'denied' && (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Turn them back on for this site in your browser settings, then try again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

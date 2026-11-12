import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { routes } from '@/app/routes'
import { initialsOf, useIdentity } from '@/saoirse/useIdentity'
import { cn } from '@/lib/utils'

/**
 * The way into "You", in the corner of the conversation.
 *
 * One control where there were two: a hamburger on the left for the conversation's things and
 * an avatar on the right that only appeared once somebody had signed in. Everything the
 * hamburger held is about the person using the app, so it lives behind the person now, and the
 * avatar is there for everybody: a silhouette until Saoirse knows who you are, then your
 * picture or your initials.
 */
export function ProfileButton({ className }: { className?: string }): ReactNode {
  const identity = useIdentity()

  return (
    <Link
      to={routes.you}
      aria-label={identity.anonymous ? 'You' : `You: ${identity.name ?? 'signed in'}`}
      className={cn(
        'focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      <Avatar className="size-8">
        {identity.avatarUrl !== null && <AvatarImage src={identity.avatarUrl} alt="" />}
        <AvatarFallback
          className={cn('text-xs', identity.anonymous && 'bg-muted text-muted-foreground')}
        >
          {identity.anonymous ? <UserRound className="size-4" /> : initialsOf(identity.name)}
        </AvatarFallback>
      </Avatar>
    </Link>
  )
}

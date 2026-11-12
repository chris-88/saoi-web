import { routes } from '@/app/routes'

/**
 * Back to Saoirse, with a full reload.
 *
 * Switching conversation, starting another and signing out all change who the page is for.
 * `session start` returns the conversation this browser is now in, so a reload lands on it by
 * itself. Threading a changed case id through the transcript, the history load, the card state
 * and the realtime subscriptions is a great deal of machinery to get subtly wrong, and getting
 * it subtly wrong in front of a room is worse than a flash of white between takes.
 */
export function landOnChat(): void {
  window.location.hash = `#${routes.saoirse}`
  window.location.reload()
}

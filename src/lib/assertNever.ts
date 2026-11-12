/**
 * The end of an exhaustive `switch`.
 *
 * Typed `never`, so a new member of the union without its own case fails the typecheck here.
 * At runtime it throws, so a value the types said could not arrive (a card type a newer server
 * sends before this build knows it) is loud rather than rendering nothing.
 */
export function assertNever(value: never, what = 'value'): never {
  const type =
    typeof value === 'object' && value !== null && 'type' in value
      ? String((value as { type: unknown }).type)
      : String(value)
  throw new Error(`Unhandled ${what}: ${type}`)
}

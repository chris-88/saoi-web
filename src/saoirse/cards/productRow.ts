/**
 * The two small readings the product card makes of a row's own words (2026-11-13, key facts):
 * the provider's initials for the monogram, and the headline value split from its period.
 * Neither invents anything; both only cut the server's strings.
 */

/** Words that stay lower case inside initials: "Bank of Ireland" is BoI. */
const SMALL_WORDS = new Set(['of', 'and', 'the', 'for'])

const compact = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** "MoCo" -> "MoCo", "AIB" -> "AIB", "bunq" -> "B": a short word with its own capitals is kept. */
function singleWordInitials(word: string): string {
  const capitals = word.replace(/[^A-Z]/g, '').length
  if (capitals >= 2 && word.length <= 4) return word
  return word.charAt(0).toUpperCase()
}

function wordsInitials(words: readonly string[]): string {
  if (words.length === 1) return singleWordInitials(words[0] ?? '')
  return words
    .map((word) =>
      SMALL_WORDS.has(word.toLowerCase())
        ? word.charAt(0).toLowerCase()
        : word.charAt(0).toUpperCase(),
    )
    .join('')
    .slice(0, 3)
}

/**
 * The provider's initials. The lead starts with the provider's name in the server's convention
 * ("bunq Easy Savings", "Bank of Ireland Fixed Term", "Your BoI savings"), so the shortest run of
 * leading words that spells the provider id, whole or by initials, is the name. Without a match
 * the id itself is used, and without an id (cards saved before 2026-11-13) the lead's first word.
 */
export function providerInitials(lead: string, providerId: string | undefined): string {
  const words = lead
    .replace(/^your\s+/i, '')
    .split(/\s+/)
    .filter((word) => word !== '')
  if (providerId !== undefined && providerId !== '') {
    const target = compact(providerId)
    for (let count = 1; count <= Math.min(words.length, 4); count += 1) {
      const run = words.slice(0, count)
      if (
        compact(run.join('')) === target ||
        compact(run.map((w) => w.charAt(0)).join('')) === target
      ) {
        return wordsInitials(run)
      }
    }
    const parts = providerId.split(/[-_\s.:]+/).filter((part) => part !== '')
    if (parts.length > 1)
      return parts
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 3)
    const only = parts[0] ?? providerId
    return only.length <= 4 ? only.toUpperCase() : only.charAt(0).toUpperCase()
  }
  const first = words[0]
  return first === undefined ? '' : singleWordInitials(first)
}

/**
 * "3.11% to 1 Jan" -> value "3.11%", period "to 1 Jan". Only a leading figure (a token with a
 * digit in it) is split off; "€1,751/mo" and "2.51%" have no period.
 */
export function splitValue(value: string): { value: string; period: string | null } {
  const match = /^(\S*\d\S*)\s+(.+)$/.exec(value.trim())
  if (match === null) return { value, period: null }
  return { value: match[1] ?? value, period: match[2] ?? null }
}

/**
 * The rows under the server's group labels, in the groups' order and each group's own order; a
 * row in no group follows them under no label, and a row named twice stays in its first group.
 * Without groups, the rows are one unlabelled list, in the order given.
 */
export function groupRows<R extends { id: string }>(
  rows: readonly R[],
  groups: readonly { label: string; rowIds: readonly string[] }[] | undefined,
): { label: string | null; rows: R[] }[] {
  if (groups === undefined || groups.length === 0) return [{ label: null, rows: [...rows] }]
  const byId = new Map(rows.map((row) => [row.id, row]))
  const placed = new Set<string>()
  const sections: { label: string | null; rows: R[] }[] = []
  for (const group of groups) {
    const members: R[] = []
    for (const id of group.rowIds) {
      const row = byId.get(id)
      if (row === undefined || placed.has(id)) continue
      placed.add(id)
      members.push(row)
    }
    if (members.length > 0) sections.push({ label: group.label, rows: members })
  }
  const rest = rows.filter((row) => !placed.has(row.id))
  if (rest.length > 0) sections.push({ label: null, rows: rest })
  return sections
}

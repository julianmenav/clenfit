/**
 * Instant search over the catalog (in memory, ~150 entries):
 * accent- and case-insensitive, scored by match quality.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SearchEntry<T> {
  item: T
  /** normalized name */
  name: string
  /** normalized aliases */
  aliases: string[]
  /** extra normalized terms (muscle and equipment labels) */
  terms: string[]
}

export function makeEntry<T>(
  item: T,
  name: string,
  aliases: string[] = [],
  terms: string[] = [],
): SearchEntry<T> {
  return {
    item,
    name: normalize(name),
    aliases: aliases.map(normalize),
    terms: terms.map(normalize),
  }
}

function tokenScore<T>(token: string, entry: SearchEntry<T>): number {
  if (entry.name.startsWith(token)) return 100
  const words = entry.name.split(' ')
  if (words.some((w) => w.startsWith(token))) return 60
  if (entry.name.includes(token)) return 40
  if (entry.aliases.some((a) => a === token || a.split(' ').some((w) => w.startsWith(token))))
    return 30
  if (entry.aliases.some((a) => a.includes(token))) return 25
  if (entry.terms.some((t) => t.startsWith(token) || t.split(' ').some((w) => w.startsWith(token))))
    return 15
  return 0
}

/**
 * Filters and sorts by relevance. Each query word must match
 * in some field (AND); the score is the sum of the best match per word.
 * Empty query → everything, in alphabetical order.
 */
export function searchEntries<T>(query: string, entries: SearchEntry<T>[]): T[] {
  const q = normalize(query)
  if (!q) {
    return [...entries].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((e) => e.item)
  }
  const tokens = q.split(' ')
  const scored: { entry: SearchEntry<T>; score: number }[] = []
  for (const entry of entries) {
    let total = 0
    let ok = true
    for (const token of tokens) {
      const s = tokenScore(token, entry)
      if (s === 0) {
        ok = false
        break
      }
      total += s
    }
    if (ok) scored.push({ entry, score: total })
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.name.length - b.entry.name.length ||
        a.entry.name.localeCompare(b.entry.name, 'es'),
    )
    .map((s) => s.entry.item)
}

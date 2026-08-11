/**
 * Numeric literals a specification states and generated code must honour.
 *
 * Two digits or more, so incidental prose counts ("5 seed records", "3 tests")
 * do not masquerade as thresholds. No trailing word boundary: the values that
 * matter most arrive suffixed — `640px`, `1024px` — and `\b\d{2,}\b` silently
 * matches none of them, which is exactly the bug this module exists to have
 * fixed once instead of twice.
 *
 * Shared because two stages depend on agreeing about it: planning warns when a
 * requirement drops a stated value, and review downgrades a "satisfied" verdict
 * that cites none of them. Two copies of this rule that drift apart would
 * produce a warning about one set of numbers and an audit about another.
 */
const STATED_VALUE = /\b\d{2,}/g;

export function extractStatedValues(text: string): string[] {
  return [...new Set(text.match(STATED_VALUE) ?? [])];
}

/**
 * True when `text` mentions at least one of `values`.
 *
 * Any, not all, because the caller applies this to source code rather than to
 * prose. A faithful implementation of "mobile up to 640px, tablet 641–1023px,
 * desktop 1024px and above" writes three of those four numbers and leaves the
 * fourth to an else branch, so demanding all of them fails correct code. An
 * implementation that ignored the specification entirely — reaching for a
 * library's 600 and 900 defaults — contains none of them.
 */
export function citesAnyValue(text: string, values: readonly string[]): boolean {
  return values.length > 0 && values.some((value) => text.includes(value));
}

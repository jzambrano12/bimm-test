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
 * True when `text` mentions every one of `values`.
 *
 * All, not any, and for a concrete reason: a requirement naming 640, 641, 1023
 * and 1024 was vouched for by evidence that mentioned only 640 — which had
 * appeared incidentally, in a placeholder image URL of 640x360. Citing one
 * threshold establishes nothing about the other three.
 */
export function citesAllValues(text: string, values: readonly string[]): boolean {
  return values.length > 0 && values.every((value) => text.includes(value));
}

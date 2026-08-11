/**
 * Runs `worker` over `items` with at most `limit` in flight, preserving input
 * order in the result.
 *
 * Deliberately small: a dependency for this would be a dependency to audit, and
 * the semantics that matter here are few. Every item is attempted even if an
 * earlier one throws — a failed generation must not cancel its siblings, since
 * they are independent by construction and one of them failing is exactly the
 * case the repair loop exists for.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];

  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;

  async function drain(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;

      const item = items[index];
      if (item === undefined) continue;

      try {
        results[index] = { status: "fulfilled", value: await worker(item, index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, drain));
  return results;
}

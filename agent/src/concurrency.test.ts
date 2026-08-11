import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency.ts";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (delay) => {
      await new Promise((done) => setTimeout(done, delay / 10));
      return delay;
    });

    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([30, 10, 20]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((done) => setTimeout(done, 5));
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("attempts every item even when one throws", async () => {
    // Tasks in a level are independent by construction, so one failing must not
    // cancel its siblings — that failure is exactly what the repair loop is for.
    const attempted: number[] = [];

    const results = await mapWithConcurrency([1, 2, 3], 2, async (item) => {
      attempted.push(item);
      if (item === 2) throw new Error("boom");
      return item;
    });

    expect(attempted.sort()).toEqual([1, 2, 3]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("reports the rejection reason rather than swallowing it", async () => {
    const [result] = await mapWithConcurrency([1], 1, async () => {
      throw new Error("specific failure");
    });

    expect(result?.status).toBe("rejected");
    expect(result?.status === "rejected" && (result.reason as Error).message).toBe(
      "specific failure",
    );
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  it("clamps a limit larger than the work", async () => {
    const results = await mapWithConcurrency([1, 2], 99, async (n) => n * 2);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([2, 4]);
  });

  it("treats a limit below one as one", async () => {
    let peak = 0;
    let inFlight = 0;

    await mapWithConcurrency([1, 2, 3], 0, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((done) => setTimeout(done, 2));
      inFlight -= 1;
    });

    expect(peak).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { estimateCost } from "./report.ts";
import type { UsageSnapshot } from "./llm/usage.ts";

function usage(promptTokens: number, completionTokens: number): UsageSnapshot {
  const empty = { calls: 0, cacheHits: 0, promptTokens: 0, completionTokens: 0 };
  return {
    byPhase: { plan: empty, generate: empty, repair: empty, review: empty },
    totals: { calls: 1, cacheHits: 0, promptTokens, completionTokens },
  };
}

describe("estimateCost", () => {
  it("prices a flash-lite run at its published rate", () => {
    // 1M input at $0.30 + 1M output at $2.50
    const cost = estimateCost("gemini-flash-lite-latest", usage(1_000_000, 1_000_000));
    expect(cost.priced).toBe(true);
    expect(cost.usd).toBeCloseTo(2.8, 5);
  });

  it("prices flash-lite below flash, since the tier is the point of choosing it", () => {
    const lite = estimateCost("gemini-flash-lite-latest", usage(100_000, 50_000));
    const flash = estimateCost("gemini-flash-latest", usage(100_000, 50_000));
    expect(lite.usd).toBeLessThan(flash.usd);
  });

  it("matches flash-lite before the broader flash pattern", () => {
    // Ordering matters: /flash/ would otherwise swallow every lite model.
    expect(estimateCost("gemini-3.5-flash-lite", usage(1_000_000, 0)).usd).toBeCloseTo(0.3, 5);
  });

  it("reports tokens without a dollar figure for an unknown model", () => {
    // A wrong default is worse than no number: someone might believe it.
    const cost = estimateCost("some-other-vendor-model", usage(1_000, 1_000));
    expect(cost.priced).toBe(false);
    expect(cost.usd).toBe(0);
    expect(cost.basis).toMatch(/LLM_PRICE_INPUT/);
  });

  it("honours explicit price overrides", () => {
    process.env["LLM_PRICE_INPUT"] = "10";
    process.env["LLM_PRICE_OUTPUT"] = "30";
    try {
      const cost = estimateCost("anything-at-all", usage(1_000_000, 1_000_000));
      expect(cost.usd).toBeCloseTo(40, 5);
      expect(cost.basis).toMatch(/overrides/);
    } finally {
      delete process.env["LLM_PRICE_INPUT"];
      delete process.env["LLM_PRICE_OUTPUT"];
    }
  });

  it("states that the free tier costs nothing", () => {
    expect(estimateCost("gemini-flash-lite-latest", usage(10, 10)).basis).toMatch(/\$0\.00/);
  });

  it("costs nothing for a run that spent no tokens", () => {
    expect(estimateCost("gemini-flash-lite-latest", usage(0, 0)).usd).toBe(0);
  });
});

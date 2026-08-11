/** The four things the agent spends tokens on. */
export type LlmPhase = "plan" | "generate" | "repair" | "review";

export const LLM_PHASES: readonly LlmPhase[] = ["plan", "generate", "repair", "review"];

export interface PhaseUsage {
  calls: number;
  cacheHits: number;
  promptTokens: number;
  completionTokens: number;
}

export interface UsageSnapshot {
  readonly byPhase: Readonly<Record<LlmPhase, PhaseUsage>>;
  readonly totals: PhaseUsage;
}

function emptyUsage(): PhaseUsage {
  return { calls: 0, cacheHits: 0, promptTokens: 0, completionTokens: 0 };
}

/**
 * Token accounting, split by phase.
 *
 * Per-phase rather than a single total on purpose: "how much did repair cost
 * relative to first-pass generation" is the number that tells you whether the
 * generation prompts are actually working, and it is the one figure the
 * write-up needs.
 */
export class UsageLedger {
  private readonly phases: Record<LlmPhase, PhaseUsage> = {
    plan: emptyUsage(),
    generate: emptyUsage(),
    repair: emptyUsage(),
    review: emptyUsage(),
  };

  record(
    phase: LlmPhase,
    tokens: { readonly promptTokens: number; readonly completionTokens: number },
  ): void {
    const bucket = this.phases[phase];
    bucket.calls += 1;
    bucket.promptTokens += tokens.promptTokens;
    bucket.completionTokens += tokens.completionTokens;
  }

  /** A cache hit is a call that did not happen — counted, but costs nothing. */
  recordCacheHit(phase: LlmPhase): void {
    this.phases[phase].cacheHits += 1;
  }

  snapshot(): UsageSnapshot {
    const totals = emptyUsage();
    for (const phase of LLM_PHASES) {
      const bucket = this.phases[phase];
      totals.calls += bucket.calls;
      totals.cacheHits += bucket.cacheHits;
      totals.promptTokens += bucket.promptTokens;
      totals.completionTokens += bucket.completionTokens;
    }

    return {
      byPhase: {
        plan: { ...this.phases.plan },
        generate: { ...this.phases.generate },
        repair: { ...this.phases.repair },
        review: { ...this.phases.review },
      },
      totals,
    };
  }
}

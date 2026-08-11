import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PromptCache } from "./llm/cache.ts";
import { LLM_PHASES, type UsageSnapshot } from "./llm/usage.ts";
import type { OrderedPlan } from "./pipeline/plan.ts";
import { renderPlan } from "./pipeline/plan.ts";
import type { RunOutcome } from "./pipeline/run.ts";

/**
 * Published per-million-token rates, for turning measured tokens into a cost
 * figure.
 *
 * Deliberately a small table matched by pattern rather than an exhaustive
 * catalogue: an unknown model reports tokens with no dollar figure, which is
 * honest, where a wrong default would be a number someone might believe. Rates
 * move, so `LLM_PRICE_INPUT` and `LLM_PRICE_OUTPUT` override them.
 *
 * Every model here also has a free tier, on which a run costs nothing at all —
 * the dollar figure answers "what would this cost at scale", not "what was
 * charged".
 */
interface Rate {
  readonly pattern: RegExp;
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

const RATES: readonly Rate[] = [
  { pattern: /flash-lite/i, inputPerMillion: 0.3, outputPerMillion: 2.5 },
  { pattern: /3\.6-flash|flash-latest/i, inputPerMillion: 1.5, outputPerMillion: 7.5 },
  { pattern: /flash/i, inputPerMillion: 1.5, outputPerMillion: 9.0 },
  { pattern: /pro/i, inputPerMillion: 4.0, outputPerMillion: 20.0 },
];

export interface CostEstimate {
  readonly priced: boolean;
  readonly usd: number;
  readonly basis: string;
}

export function estimateCost(model: string, usage: UsageSnapshot): CostEstimate {
  const overrideInput = Number(process.env["LLM_PRICE_INPUT"]);
  const overrideOutput = Number(process.env["LLM_PRICE_OUTPUT"]);
  const hasOverride = Number.isFinite(overrideInput) && Number.isFinite(overrideOutput);

  const rate = hasOverride
    ? { inputPerMillion: overrideInput, outputPerMillion: overrideOutput }
    : RATES.find((entry) => entry.pattern.test(model));

  if (rate === undefined) {
    return {
      priced: false,
      usd: 0,
      basis: `no published rate known for ${model}; set LLM_PRICE_INPUT and LLM_PRICE_OUTPUT to price it`,
    };
  }

  const usd =
    (usage.totals.promptTokens / 1_000_000) * rate.inputPerMillion +
    (usage.totals.completionTokens / 1_000_000) * rate.outputPerMillion;

  return {
    priced: true,
    usd,
    basis:
      `$${rate.inputPerMillion}/M input, $${rate.outputPerMillion}/M output` +
      `${hasOverride ? " (from LLM_PRICE_* overrides)" : ""}. Free tier cost is $0.00`,
  };
}

export interface RunReport {
  readonly spec: string;
  readonly outputDir: string;
  readonly provider: string;
  readonly plannerModel: string;
  readonly workerModel: string;
  readonly usage: UsageSnapshot;
  readonly cost: CostEstimate;
  readonly cache: ReturnType<PromptCache["stats"]>;
  readonly ordered: OrderedPlan;
  readonly outcome: RunOutcome;
  readonly durationMs: number;
}

/**
 * Writes the run's artefacts next to the generated app.
 *
 * Two files rather than one because they answer different questions. plan.md is
 * what a human reads to understand what the agent decided to build; report.json
 * is what a script reads to check whether it worked. Neither is a substitute for
 * the other, and folding them together would serve neither well.
 */
export async function writeRunArtifacts(directory: string, report: RunReport): Promise<string[]> {
  const runDirectory = join(directory, ".agent-run");
  await mkdir(runDirectory, { recursive: true });

  const planPath = join(runDirectory, "plan.md");
  const reportPath = join(runDirectory, "report.json");

  await writeFile(
    planPath,
    [
      "# Generated plan",
      "",
      `Spec: \`${report.spec}\``,
      `Planner: \`${report.plannerModel}\` · Generator: \`${report.workerModel}\``,
      "",
      "```",
      renderPlan(report.ordered),
      "```",
      "",
      "## Requirement traceability",
      "",
      "| Requirement | Required | Tasks | Review |",
      "| --- | --- | --- | --- |",
      ...report.ordered.plan.requirements.map((requirement) => {
        const tasks = report.ordered.plan.tasks
          .filter((task) => task.satisfies.includes(requirement.id))
          .map((task) => task.id);
        const finding = report.outcome.review?.findings.find(
          (entry) => entry.requirementId === requirement.id,
        );
        return `| ${requirement.id} | ${requirement.required ? "yes" : "no"} | ${tasks.join(", ") || "—"} | ${finding?.status ?? "not reviewed"} |`;
      }),
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        spec: report.spec,
        outputDir: report.outputDir,
        provider: report.provider,
        models: { planner: report.plannerModel, worker: report.workerModel },
        durationMs: report.durationMs,
        result: {
          typecheckClean: report.outcome.typecheckClean,
          testsPassed: report.outcome.testsPassed,
          filesWritten: report.ordered.plan.tasks.flatMap((task) => task.targetFiles),
        },
        usage: {
          calls: report.usage.totals.calls,
          cacheHits: report.usage.totals.cacheHits,
          promptTokens: report.usage.totals.promptTokens,
          completionTokens: report.usage.totals.completionTokens,
          byPhase: Object.fromEntries(
            LLM_PHASES.map((phase) => [phase, report.usage.byPhase[phase]]),
          ),
        },
        cost: {
          priced: report.cost.priced,
          estimatedUsd: Number(report.cost.usd.toFixed(4)),
          basis: report.cost.basis,
        },
        cache: report.cache,
        planWarnings: report.ordered.warnings,
        tasks: report.outcome.tasks,
        review:
          report.outcome.review === undefined
            ? null
            : {
                assessment: report.outcome.review.assessment,
                downgraded: report.outcome.review.downgraded,
                prohibitions: report.ordered.plan.prohibitions,
                breaches: report.outcome.review.breaches,
                findings: report.outcome.review.findings,
                unroutable: report.outcome.review.unroutable.map((entry) => ({
                  requirementId: entry.finding.requirementId,
                  reason: entry.reason,
                })),
              },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return [planPath, reportPath];
}

/** The per-phase cost breakdown, for the terminal summary. */
export function renderCostLines(usage: UsageSnapshot, cost: CostEstimate): string[] {
  const lines = LLM_PHASES.filter((phase) => usage.byPhase[phase].calls > 0).map((phase) => {
    const bucket = usage.byPhase[phase];
    return `  ${phase.padEnd(9)}${String(bucket.calls).padStart(3)} call(s), ${
      bucket.promptTokens + bucket.completionTokens
    } tokens`;
  });

  lines.push(
    cost.priced
      ? `  estimated cost $${cost.usd.toFixed(4)} at ${cost.basis}`
      : `  cost not estimated: ${cost.basis}`,
  );

  return lines;
}

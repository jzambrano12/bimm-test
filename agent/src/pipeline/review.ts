import type OpenAI from "openai";
import { completeStructured } from "../llm/structured.ts";
import type { UsageLedger } from "../llm/usage.ts";
import { REVIEWER_SYSTEM, buildReviewerUser } from "../prompts/reviewer.ts";
import {
  ReviewVerdict,
  type PlannedTask,
  type ReviewFinding,
  type SpecRequirement,
} from "../schemas.ts";
import { citesAnyValue, extractStatedValues } from "../context/specValues.ts";
import { checkWritable } from "../tools/fs.ts";
import type { GenerationContext } from "./generate.ts";
import type { OrderedPlan } from "./plan.ts";

/**
 * Total characters of generated source sent to the reviewer.
 *
 * One call that sees the whole app is both cheaper and more accurate than one
 * call per requirement: cross-cutting requirements are exactly the ones a
 * per-file reviewer misses. The cap protects the context window; a build large
 * enough to exceed it gets a truncated listing and an explicit warning rather
 * than a silently partial review.
 */
const REVIEW_SOURCE_BUDGET = 60_000;

export interface RemediationTarget {
  readonly finding: ReviewFinding;
  readonly task: PlannedTask;
}

export interface ReviewOutcome {
  readonly findings: readonly ReviewFinding[];
  readonly assessment: string;
  /** Findings a task could be found for, and which will be repaired. */
  readonly actionable: readonly RemediationTarget[];
  /** Findings with nowhere to route them, and why. */
  readonly unroutable: readonly { finding: ReviewFinding; reason: string }[];
  readonly truncated: boolean;
  /** Requirement ids whose "satisfied" verdict its own evidence did not support. */
  readonly downgraded: readonly string[];
}

/**
 * Asks the reviewer to judge the built app against the requirements.
 *
 * Deliberately reads the files from disk rather than from the artifact registry:
 * by this point the repair loop has rewritten several of them, and reviewing the
 * first draft of code that has since changed would be worse than not reviewing
 * at all.
 */
export async function reviewBuild(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  ordered: OrderedPlan,
  spec: string,
  model: string,
): Promise<ReviewOutcome> {
  const owned = ordered.plan.tasks.flatMap((task) => task.targetFiles);

  const files: { path: string; contents: string }[] = [];
  let used = 0;
  let truncated = false;

  for (const path of owned) {
    const contents = await context.fs.read(path).catch(() => "");
    if (contents === "") continue;

    if (used + contents.length > REVIEW_SOURCE_BUDGET) {
      truncated = true;
      continue;
    }
    files.push({ path, contents });
    used += contents.length;
  }

  const verdict = await completeStructured(client, ledger, {
    model,
    phase: "review",
    system: REVIEWER_SYSTEM,
    user: buildReviewerUser({ requirements: ordered.plan.requirements, spec, files }),
    schema: ReviewVerdict,
    schemaName: "ReviewVerdict",
  });

  const audited = auditFindings(verdict.findings, ordered.plan.requirements);

  return {
    findings: audited.findings,
    assessment: verdict.assessment,
    truncated,
    downgraded: audited.downgraded,
    ...routeFindings(audited.findings, ordered),
  };
}

/**
 * Checks the reviewer's verdicts against its own evidence.
 *
 * Every other model output in this agent is verified rather than trusted, and the
 * reviewer was the exception — which showed. Asked to judge a requirement stating
 * 640px and 1024px thresholds against a component using its UI library's 600px
 * and 900px defaults, it returned "satisfied" with evidence that never mentioned
 * a single number. The verdict was wrong and the evidence did not support it
 * either way.
 *
 * So: when a requirement states specific values and a finding claims
 * `satisfied` without citing any of them, the claim is unsupported and is
 * downgraded to `partial`. This holds regardless of which model reviewed, which
 * matters because review quality varies most across model tiers.
 */
export function auditFindings(
  findings: readonly ReviewFinding[],
  requirements: readonly SpecRequirement[],
): { findings: ReviewFinding[]; downgraded: readonly string[] } {
  const textOf = new Map(requirements.map((requirement) => [requirement.id, requirement.text]));
  const downgraded: string[] = [];

  const audited = findings.map((finding): ReviewFinding => {
    if (finding.status !== "satisfied") return finding;

    const requirementText = textOf.get(finding.requirementId);
    if (requirementText === undefined) return finding;

    const stated = extractStatedValues(requirementText);
    if (stated.length === 0) return finding;
    if (citesAnyValue(finding.evidence, stated)) return finding;

    downgraded.push(finding.requirementId);
    return {
      ...finding,
      status: "partial",
      evidence:
        `${finding.evidence} [Downgraded automatically: the requirement states ` +
        `${stated.join(", ")}, and this evidence cites none of those values, so the ` +
        `claim that they are implemented is unsupported.]`,
      remediationTitle:
        finding.remediationTitle === ""
          ? `Use the exact values the specification states (${stated.join(", ")})`
          : finding.remediationTitle,
    };
  });

  return { findings: audited, downgraded };
}

/**
 * Maps each unsatisfied finding to the task that owns the file a fix would touch.
 *
 * Routing through task ownership rather than editing files directly keeps one
 * invariant intact: every file has exactly one author, and that author is the
 * only thing that may change it. A finding pointing at a protected path or at a
 * file nobody owns is reported rather than acted on — the reviewer is allowed to
 * be wrong about where a fix belongs, and it should not be able to launder that
 * mistake into a write.
 */
export function routeFindings(
  findings: readonly ReviewFinding[],
  ordered: OrderedPlan,
): Pick<ReviewOutcome, "actionable" | "unroutable"> {
  const ownerOf = new Map<string, PlannedTask>();
  for (const task of ordered.plan.tasks) {
    for (const file of task.targetFiles) ownerOf.set(file, task);
  }

  const requiredIds = new Set(
    ordered.plan.requirements.filter((requirement) => requirement.required).map((r) => r.id),
  );

  const actionable: RemediationTarget[] = [];
  const unroutable: { finding: ReviewFinding; reason: string }[] = [];
  const claimed = new Set<string>();

  for (const finding of findings) {
    if (finding.status === "satisfied") continue;

    // An optional requirement the build skipped is a choice, not a defect. Only
    // spend a repair call when the spec actually demanded it.
    if (!requiredIds.has(finding.requirementId)) {
      unroutable.push({
        finding,
        reason: "optional requirement — reported, not repaired",
      });
      continue;
    }

    // A finding may name no file — either because the reviewer omitted it, or
    // because an audited downgrade produced it. The plan already records which
    // tasks serve which requirement, so the fix still has an owner.
    const namedFiles =
      finding.remediationFiles.length > 0
        ? finding.remediationFiles
        : ordered.plan.tasks
            .filter((task) => task.satisfies.includes(finding.requirementId) && task.kind !== "test")
            .flatMap((task) => task.targetFiles);

    if (namedFiles.length === 0) {
      unroutable.push({
        finding,
        reason: "no file named and no task claims this requirement",
      });
      continue;
    }

    const protectedTarget = namedFiles.find((file) => !checkWritable(file).allowed);
    if (protectedTarget !== undefined) {
      unroutable.push({
        finding,
        reason: `would require changing ${protectedTarget}, which is provided infrastructure`,
      });
      continue;
    }

    const target = namedFiles
      .map((file) => ownerOf.get(file))
      .find((task): task is PlannedTask => task !== undefined);

    if (target === undefined) {
      unroutable.push({ finding, reason: `no task owns ${namedFiles.join(", ")}` });
      continue;
    }

    // One repair per task per review round: two findings on one file are better
    // fixed together, and the prompt carries both.
    if (claimed.has(target.id)) {
      const existing = actionable.find((entry) => entry.task.id === target.id);
      if (existing !== undefined) {
        actionable.push({ finding, task: target });
      }
      continue;
    }

    claimed.add(target.id);
    actionable.push({ finding, task: target });
  }

  return { actionable, unroutable };
}

/**
 * Renders findings for a repair prompt.
 *
 * The evidence is included verbatim because it is the most useful part: it
 * already contains the comparison between what was asked and what was written,
 * which is precisely the information a fix needs.
 */
export function formatFindingsForRepair(
  targets: readonly RemediationTarget[],
  requirementText: (id: string) => string,
): string {
  return targets
    .map((target) =>
      [
        `Requirement "${target.finding.requirementId}": ${requirementText(target.finding.requirementId)}`,
        `Status: ${target.finding.status}`,
        `Reviewer's evidence: ${target.finding.evidence}`,
        `Required change: ${target.finding.remediationTitle}`,
      ].join("\n"),
    )
    .join("\n\n");
}

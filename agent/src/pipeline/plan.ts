import type OpenAI from "openai";
import { completeStructured } from "../llm/structured.ts";
import type { UsageLedger } from "../llm/usage.ts";
import { PLANNER_SYSTEM, buildPlannerUser } from "../prompts/planner.ts";
import { TaskPlan, type PlannedTask } from "../schemas.ts";
import { extractStatedValues } from "../context/specValues.ts";
import { checkWritable } from "../tools/fs.ts";

export class PlanValidationError extends Error {
  /**
   * The summary and the individual issues are both in `message` so that
   * printing the error is enough to act on it, while `issues` stays available
   * verbatim for the correction prompt.
   */
  constructor(
    summary: string,
    readonly issues: readonly string[],
  ) {
    super(`${summary}:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
  }
}

export interface OrderedPlan {
  readonly plan: TaskPlan;
  /** Tasks grouped into dependency levels; every level may run in parallel. */
  readonly levels: readonly (readonly PlannedTask[])[];
  /** Non-fatal problems worth reporting but not worth rejecting a plan over. */
  readonly warnings: readonly string[];
}

/**
 * Structural problems that make a plan unexecutable.
 *
 * A schema keeps the *shape* honest; it cannot keep the *graph* honest. A plan
 * can satisfy every type and still contain a cycle, a dangling dependency, or a
 * write to provided infrastructure. Catching that here — deterministically,
 * before a single token is spent on generation — is cheaper than discovering it
 * as a confusing compile error twelve calls later.
 */
function findErrors(plan: TaskPlan): string[] {
  const issues: string[] = [];
  const ids = plan.tasks.map((task) => task.id);
  const idSet = new Set(ids);

  if (idSet.size !== ids.length) {
    const seen = new Set<string>();
    const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    issues.push(`duplicate task ids: ${[...new Set(duplicates)].join(", ")}`);
  }

  const owners = new Map<string, string[]>();
  for (const task of plan.tasks) {
    for (const file of task.targetFiles) {
      owners.set(file, [...(owners.get(file) ?? []), task.id]);

      const decision = checkWritable(file);
      if (!decision.allowed) {
        issues.push(`task "${task.id}" targets ${file}: ${decision.reason}`);
      }
    }

    for (const dependency of task.dependsOn) {
      if (dependency === task.id) {
        issues.push(`task "${task.id}" depends on itself`);
      } else if (!idSet.has(dependency)) {
        issues.push(`task "${task.id}" depends on unknown task "${dependency}"`);
      }
    }

    // A test with no dependencies is scheduled in the first level, before the
    // code it covers exists, so it is written against an imagined subject. This
    // happened: a planner put an App integration test at level one with no
    // dependencies while App was generated at level three, and the test failed
    // for reasons no repair could reach. The prompt asks for the dependency;
    // this makes it a requirement.
    if (task.kind === "test" && task.dependsOn.length === 0) {
      issues.push(
        `test task "${task.id}" declares no dependencies — a test must depend on the ` +
          `task whose output it covers, or it will be generated before that code exists`,
      );
    }
  }

  for (const [file, claimants] of owners) {
    if (claimants.length > 1) {
      issues.push(
        `${file} is claimed by ${claimants.length} tasks (${claimants.join(", ")}); ` +
          `exactly one task must own each file`,
      );
    }
  }

  return issues;
}

/**
 * Warns when the requirement list drops a value the specification stated.
 *
 * The requirement text is a lossy compression of the spec, and every stage after
 * planning reads the compression rather than the original. A run once lost
 * "640px", "1023px" and "1024px" from a viewport requirement, and the
 * consequences cascaded: the generator, never having seen the thresholds, reached
 * for its UI library's defaults, and the reviewer had nothing to compare against
 * and passed it. Two stages failed for one upstream omission.
 *
 * A warning rather than an error, because prose contains incidental numbers — a
 * count of seed records, a version — and blocking a plan over one would be worse
 * than the omission it prevents.
 */
function findDroppedSpecValues(plan: TaskPlan, spec: string): string[] {
  const stated = extractStatedValues(spec);
  if (stated.length === 0) return [];

  const carried = new Set(
    extractStatedValues(
      plan.requirements
        .map((requirement) => requirement.text)
        .concat(plan.tasks.map((task) => task.acceptanceCriteria.join(" ")))
        .join(" "),
    ),
  );

  const dropped = stated.filter((value) => !carried.has(value));
  if (dropped.length === 0) return [];

  return [
    `the specification states ${dropped.join(", ")}, and no requirement or acceptance ` +
      `criterion repeats these values — later stages never see the specification, so any ` +
      `value missing here is one the generated code will choose for itself`,
  ];
}

function findWarnings(plan: TaskPlan): string[] {
  const warnings: string[] = [];
  const requirementIds = new Set(plan.requirements.map((requirement) => requirement.id));
  const cited = new Set(plan.tasks.flatMap((task) => task.satisfies));

  for (const task of plan.tasks) {
    for (const requirement of task.satisfies) {
      if (!requirementIds.has(requirement)) {
        warnings.push(`task "${task.id}" cites unknown requirement "${requirement}"`);
      }
    }
  }

  // A mandatory requirement no task claims is the clearest possible signal of an
  // incomplete plan. Not fatal — the reviewer stage exists to catch what slips
  // through — but it belongs in the run report either way.
  for (const requirement of plan.requirements) {
    if (requirement.required && !cited.has(requirement.id)) {
      warnings.push(
        `no task satisfies required requirement "${requirement.id}" (${requirement.text})`,
      );
    }
  }

  return warnings;
}

/**
 * Kahn's algorithm, grouped by level rather than flattened.
 *
 * Levels are what make parallelism safe: everything in one level is mutually
 * independent by construction, so the executor can run a level concurrently
 * without reasoning about ordering at all.
 */
function toLevels(tasks: readonly PlannedTask[]): {
  levels: PlannedTask[][];
  unresolved: PlannedTask[];
} {
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const settled = new Set<string>();
  const levels: PlannedTask[][] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((task) =>
      task.dependsOn.every((dependency) => settled.has(dependency)),
    );

    // No task can start: the remainder contains a cycle.
    if (ready.length === 0) break;

    for (const task of ready) remaining.delete(task.id);
    for (const task of ready) settled.add(task.id);
    levels.push(ready);
  }

  return { levels, unresolved: [...remaining.values()] };
}

/**
 * @param spec When given, the plan is additionally checked for specification
 *   values its requirement list failed to carry forward.
 */
export function validateAndOrder(plan: TaskPlan, spec?: string): OrderedPlan {
  const issues = findErrors(plan);

  // Ordering is only meaningful once references resolve, so bail before it.
  if (issues.length > 0) {
    throw new PlanValidationError(`Plan has ${issues.length} structural problem(s)`, issues);
  }

  const { levels, unresolved } = toLevels(plan.tasks);
  if (unresolved.length > 0) {
    const involved = unresolved.map((task) => `${task.id} -> [${task.dependsOn.join(", ")}]`);
    throw new PlanValidationError("Plan dependency graph contains a cycle", [
      `cycle among: ${involved.join("; ")}`,
    ]);
  }

  const warnings = [
    ...findWarnings(plan),
    ...(spec === undefined ? [] : findDroppedSpecValues(plan, spec)),
  ];

  return { plan, levels, warnings };
}

export interface PlanRequest {
  readonly model: string;
  readonly spec: string;
  readonly contract: string;
}

/**
 * Produces a validated, ordered plan, with one correction round.
 *
 * The retry mirrors the structured-output reparse one layer down: hand the model
 * its own output plus the exact structural complaints. A planner that emitted a
 * cycle has almost always made a local mistake it can fix when told precisely
 * what broke — far more effective than re-rolling the prompt and hoping for a
 * different sample.
 */
export async function createPlan(
  client: OpenAI,
  ledger: UsageLedger,
  request: PlanRequest,
): Promise<OrderedPlan> {
  const user = buildPlannerUser(request.spec, request.contract);

  const first = await completeStructured(client, ledger, {
    model: request.model,
    phase: "plan",
    system: PLANNER_SYSTEM,
    user,
    schema: TaskPlan,
    schemaName: "TaskPlan",
  });

  try {
    return validateAndOrder(first, request.spec);
  } catch (error) {
    if (!(error instanceof PlanValidationError)) throw error;

    const corrected = await completeStructured(client, ledger, {
      model: request.model,
      phase: "plan",
      system: PLANNER_SYSTEM,
      user:
        `${user}\n\n---\n\n## Your previous plan was rejected\n\n` +
        `\`\`\`json\n${JSON.stringify(first, null, 2)}\n\`\`\`\n\n` +
        `It failed mechanical validation:\n${error.issues.map((issue) => `- ${issue}`).join("\n")}\n\n` +
        `Return a corrected plan. Keep every task that was fine.`,
      schema: TaskPlan,
      schemaName: "TaskPlan",
    });

    return validateAndOrder(corrected, request.spec);
  }
}

/** Human-readable plan, for --dry-run and the run report. */
export function renderPlan(ordered: OrderedPlan): string {
  const { plan, levels, warnings } = ordered;
  const lines: string[] = [plan.summary, ""];

  const required = plan.requirements.filter((requirement) => requirement.required);
  const optional = plan.requirements.filter((requirement) => !requirement.required);

  lines.push(`Requirements: ${required.length} required, ${optional.length} optional`);
  for (const requirement of plan.requirements) {
    lines.push(`  ${requirement.required ? "[required]" : "[optional]"} ${requirement.id}: ${requirement.text}`);
  }

  lines.push("", `Tasks: ${plan.tasks.length} across ${levels.length} dependency level(s)`);
  levels.forEach((level, index) => {
    const parallel = level.length > 1 ? ` — ${level.length} in parallel` : "";
    lines.push(`  level ${index + 1}${parallel}`);
    for (const task of level) {
      lines.push(`    ${task.id} (${task.kind}) → ${task.targetFiles.join(", ")}`);
      lines.push(`      ${task.title}`);
      if (task.dependsOn.length > 0) {
        lines.push(`      needs: ${task.dependsOn.join(", ")}`);
      }
      lines.push(`      satisfies: ${task.satisfies.join(", ") || "(nothing cited)"}`);
    }
  });

  if (warnings.length > 0) {
    lines.push("", `Warnings (${warnings.length}):`);
    for (const warning of warnings) lines.push(`  - ${warning}`);
  }

  return lines.join("\n");
}

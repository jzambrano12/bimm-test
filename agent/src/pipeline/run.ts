import type OpenAI from "openai";
import type { UsageLedger } from "../llm/usage.ts";
import type { GeneratedFile, PlannedTask } from "../schemas.ts";
import {
  GenerationContractError,
  generateTask,
  repairTask,
  type GenerationContext,
} from "./generate.ts";
import type { OrderedPlan } from "./plan.ts";
import {
  formatFindingsForRepair,
  reviewBuild,
  type RemediationTarget,
  type ReviewOutcome,
} from "./review.ts";
import {
  diagnoseHarnessFailure,
  diagnosticsForFiles,
  ensureDependencies,
  formatDiagnostics,
  runTests,
  typecheck,
  type Diagnostic,
} from "./validate.ts";

export type TaskStatus =
  /** Compiled on the first attempt. */
  | "generated"
  /** Compiled after one or more repairs. */
  | "repaired"
  /** Still failing after the repair budget was spent. */
  | "degraded"
  /** Never attempted, because generation threw a non-recoverable error. */
  | "failed";

export interface TaskOutcome {
  readonly taskId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly repairAttempts: number;
  readonly files: readonly string[];
  /** Diagnostics still outstanding when the budget ran out. */
  readonly unresolved: readonly string[];
  readonly note: string;
}

export interface RunOutcome {
  readonly tasks: readonly TaskOutcome[];
  readonly typecheckClean: boolean;
  readonly testsPassed: boolean;
  readonly testOutput: string;
  readonly outstandingDiagnostics: readonly Diagnostic[];
  /** Absent when review was skipped. */
  readonly review: ReviewOutcome | undefined;
}

export interface RunOptions {
  readonly maxRepairs: number;
  /** Keep the boilerplate's Example reference files in the delivered app. */
  readonly keepExamples: boolean;
  /** The specification verbatim, for the review stage to judge against. */
  readonly spec: string;
  /** Model for the review call — few calls, high leverage. */
  readonly reviewModel: string;
  readonly skipReview: boolean;
  readonly onProgress: (label: string, detail: string) => void;
}

/**
 * The boilerplate's reference component and test, which document the expected
 * idiom and are explicitly marked as deletable. They serve the agent as its
 * few-shot example and then have no place in the delivered app.
 */
const EXAMPLE_FILES: readonly string[] = [
  "src/components/Example.tsx",
  "src/__tests__/Example.test.tsx",
];

/**
 * Deterministic cleanup. Removing two known files is not a decision that needs a
 * language model, and running it before the final verification means the
 * reported typecheck and test results describe the app as delivered rather than
 * the app plus scaffolding.
 */
async function removeExampleFiles(context: GenerationContext): Promise<string[]> {
  const removed: string[] = [];
  for (const path of EXAMPLE_FILES) {
    if (await context.fs.exists(path)) {
      await context.fs.remove(path);
      removed.push(path);
    }
  }
  return removed;
}

function summarise(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map(
    (diagnostic) => `${diagnostic.file}:${diagnostic.line} ${diagnostic.code}: ${diagnostic.message.split("\n")[0] ?? ""}`,
  );
}

/**
 * Generates one task and repairs it until it compiles or the budget is spent.
 *
 * The compiler runs after each attempt rather than once at the end, so a failure
 * is attributed to the task that introduced it while that task is still the
 * subject. Diagnostics handed to a repair are scoped to the task's own files:
 * errors elsewhere are either another task's problem or a consequence this task
 * cannot legally fix, since it has no write access outside its own paths.
 */
async function runTask(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  task: PlannedTask,
  options: RunOptions,
  cwd: string,
): Promise<TaskOutcome> {
  const base = { taskId: task.id, title: task.title, files: task.targetFiles };

  let files: readonly GeneratedFile[];
  try {
    files = await generateTask(client, ledger, context, task);
  } catch (error) {
    // An off-contract shape is recoverable — the model produced the wrong files,
    // not unusable ones — but only through the repair path, which needs
    // something to repair. With nothing written, the task is simply failed.
    if (error instanceof GenerationContractError) {
      return {
        ...base,
        status: "failed",
        repairAttempts: 0,
        unresolved: [error.message],
        note: "generation did not produce the declared files",
      };
    }
    throw error;
  }

  for (let attempt = 0; attempt <= options.maxRepairs; attempt += 1) {
    const result = await typecheck(cwd);
    const mine = diagnosticsForFiles(result.diagnostics, task.targetFiles);

    if (mine.length === 0) {
      return {
        ...base,
        status: attempt === 0 ? "generated" : "repaired",
        repairAttempts: attempt,
        unresolved: [],
        note: attempt === 0 ? "" : `compiled after ${attempt} repair attempt(s)`,
      };
    }

    if (attempt === options.maxRepairs) {
      options.onProgress(
        "degraded",
        `${task.id}: ${mine.length} error(s) remain after ${attempt} repair attempt(s)`,
      );
      return {
        ...base,
        status: "degraded",
        repairAttempts: attempt,
        unresolved: summarise(mine),
        note: `repair budget of ${options.maxRepairs} exhausted; run continued without this task`,
      };
    }

    options.onProgress("repair", `${task.id}: ${mine.length} error(s), attempt ${attempt + 1}`);

    try {
      files = await repairTask(
        client,
        ledger,
        context,
        task,
        files,
        formatDiagnostics(mine),
        attempt + 1,
      );
    } catch (error) {
      if (error instanceof GenerationContractError) {
        return {
          ...base,
          status: "degraded",
          repairAttempts: attempt + 1,
          unresolved: summarise(mine),
          note: "a repair attempt drifted off contract and was rejected",
        };
      }
      throw error;
    }
  }

  // Unreachable: the loop returns on every path.
  throw new Error(`repair loop for "${task.id}" exited without a verdict`);
}

/**
 * Executes a validated plan.
 *
 * Two loops at different granularities. The inner one, per task, is generate →
 * typecheck → repair, bounded. The outer one runs the test suite once the graph
 * is complete and repairs the tasks that own failing test files.
 *
 * A task that exhausts its budget is recorded as degraded and the run carries
 * on. That is the deliberate choice: an app missing one component is something a
 * reviewer can run, read and judge, while an aborted run leaves nothing at all.
 * What the agent owes in exchange is an honest account of what it could not
 * finish, which is what TaskOutcome carries.
 */
export async function executePlan(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  ordered: OrderedPlan,
  cwd: string,
  options: RunOptions,
): Promise<RunOutcome> {
  const install = await ensureDependencies(cwd);
  if (!install.ok) {
    throw new Error(`Could not install dependencies in ${cwd}:\n${install.output}`);
  }
  options.onProgress("dependencies", install.output.split("\n")[0] ?? "installed");

  const outcomes: TaskOutcome[] = [];

  for (const [index, level] of ordered.levels.entries()) {
    for (const task of level) {
      const outcome = await runTask(client, ledger, context, task, options, cwd);
      outcomes.push(outcome);
      options.onProgress(
        `level ${index + 1}`,
        `${task.id} [${outcome.status}] → ${outcome.files.join(", ")}`,
      );
    }
  }

  const outerOutcomes = await repairFailingTests(
    client,
    ledger,
    context,
    ordered,
    cwd,
    options,
    outcomes,
  );

  const review = options.skipReview
    ? undefined
    : await runReviewPhase(client, ledger, context, ordered, cwd, options);

  if (!options.keepExamples) {
    const removed = await removeExampleFiles(context);
    if (removed.length > 0) {
      options.onProgress("cleanup", `removed ${removed.length} reference file(s)`);
    }
  }

  const finalTypecheck = await typecheck(cwd);
  const finalTests = await runTests(cwd);

  return {
    tasks: outerOutcomes,
    typecheckClean: finalTypecheck.ok,
    testsPassed: finalTests.ok,
    testOutput: finalTests.output,
    outstandingDiagnostics: finalTypecheck.diagnostics,
    review,
  };
}

/**
 * The third validation tier: a reviewer that reads the specification.
 *
 * One round, deliberately. The reviewer's value is catching what the compiler and
 * the tests structurally cannot — a requirement implemented with the wrong
 * values. That is a bounded class of problem, and a second round mostly produces
 * a second opinion rather than new information.
 */
async function runReviewPhase(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  ordered: OrderedPlan,
  cwd: string,
  options: RunOptions,
): Promise<ReviewOutcome> {
  const review = await reviewBuild(
    client,
    ledger,
    context,
    ordered,
    options.spec,
    options.reviewModel,
  );

  const counts = { satisfied: 0, partial: 0, missing: 0 };
  for (const finding of review.findings) counts[finding.status] += 1;
  options.onProgress(
    "review",
    `${counts.satisfied} satisfied, ${counts.partial} partial, ${counts.missing} missing` +
      (review.truncated ? " (source listing truncated)" : ""),
  );

  if (review.downgraded.length > 0) {
    options.onProgress(
      "review",
      `downgraded ${review.downgraded.join(", ")}: claimed satisfied without citing the ` +
        `specification's stated values`,
    );
  }

  for (const { finding, reason } of review.unroutable) {
    options.onProgress("review", `${finding.requirementId}: ${reason}`);
  }

  if (review.actionable.length === 0) return review;

  const requirementText = (id: string): string =>
    ordered.plan.requirements.find((requirement) => requirement.id === id)?.text ?? id;

  // Group by task so two findings on one file are fixed in a single call, with
  // both in the prompt, rather than sequentially overwriting each other.
  const byTask = new Map<string, RemediationTarget[]>();
  for (const target of review.actionable) {
    byTask.set(target.task.id, [...(byTask.get(target.task.id) ?? []), target]);
  }

  for (const [taskId, targets] of byTask) {
    const task = targets[0]?.task;
    if (task === undefined) continue;

    options.onProgress("remediate", `${taskId}: ${targets.length} finding(s)`);

    const previous = await Promise.all(
      task.targetFiles.map(async (path) => ({
        path,
        contents: await context.fs.read(path).catch(() => ""),
        exports: [] as string[],
      })),
    );

    try {
      await repairTask(
        client,
        ledger,
        context,
        task,
        previous,
        `A reviewer compared this code against the specification and found:\n\n${formatFindingsForRepair(targets, requirementText)}`,
        1,
      );
    } catch (error) {
      if (!(error instanceof GenerationContractError)) throw error;
      options.onProgress("remediate", `${taskId}: rejected off-contract remediation`);
    }
  }

  // A remediation is still code, and can break what already compiled. Nothing
  // else would catch that: the per-task loops have finished by now.
  await stabilise(client, ledger, context, ordered, cwd, options);
  return review;
}

/**
 * Re-establishes a clean typecheck after the review phase edited files.
 *
 * Bounded by the same repair budget. Each round repairs every task that owns
 * errors, so a mistake that propagated across two files converges instead of
 * ping-ponging between them.
 */
async function stabilise(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  ordered: OrderedPlan,
  cwd: string,
  options: RunOptions,
): Promise<void> {
  for (let attempt = 1; attempt <= options.maxRepairs; attempt += 1) {
    const result = await typecheck(cwd);
    if (result.ok) {
      if (attempt > 1) options.onProgress("stabilise", `clean after ${attempt - 1} round(s)`);
      return;
    }

    const affected = ordered.plan.tasks.filter(
      (task) => diagnosticsForFiles(result.diagnostics, task.targetFiles).length > 0,
    );
    if (affected.length === 0) return;

    options.onProgress(
      "stabilise",
      `${result.diagnostics.length} error(s) after remediation, repairing ${affected.length} task(s)`,
    );

    for (const task of affected) {
      const mine = diagnosticsForFiles(result.diagnostics, task.targetFiles);
      const previous = await Promise.all(
        task.targetFiles.map(async (path) => ({
          path,
          contents: await context.fs.read(path).catch(() => ""),
          exports: [] as string[],
        })),
      );

      try {
        await repairTask(
          client,
          ledger,
          context,
          task,
          previous,
          formatDiagnostics(mine),
          attempt,
        );
      } catch (error) {
        if (!(error instanceof GenerationContractError)) throw error;
      }
    }
  }
}

/**
 * The outer loop: run the suite, then repair the tasks owning failed test files.
 *
 * Only the owning task is repaired, which is a real limit worth naming. If a test
 * fails because the component under test is wrong rather than the test, the test
 * task cannot fix it — it has no write access to the component. The honest
 * outcome is a degraded task and a note pointing at the likely culprit, rather
 * than a repair that deletes the assertion to make the suite green.
 */
async function repairFailingTests(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  ordered: OrderedPlan,
  cwd: string,
  options: RunOptions,
  outcomes: readonly TaskOutcome[],
): Promise<TaskOutcome[]> {
  const merged = [...outcomes];
  const ownerOf = new Map<string, PlannedTask>();
  for (const task of ordered.plan.tasks) {
    for (const file of task.targetFiles) ownerOf.set(file, task);
  }

  for (let attempt = 1; attempt <= options.maxRepairs; attempt += 1) {
    const tests = await runTests(cwd);
    if (tests.ok) {
      options.onProgress("tests", attempt === 1 ? "passed" : `passed after ${attempt - 1} repair round(s)`);
      return merged;
    }

    // Stop before spending anything if the runner, not the code, is broken.
    // Repairing a test file cannot fix an unresolvable import, and the model
    // cannot tell the difference from the failure text alone.
    const harnessProblem = diagnoseHarnessFailure(tests.output);
    if (harnessProblem !== undefined) {
      options.onProgress(
        "tests",
        `not repairable: ${harnessProblem}. This is a project or configuration ` +
          `fault, not generated code — skipping test repair.`,
      );
      return merged.map((entry) => ({
        ...entry,
        note:
          entry.note === ""
            ? `test suite could not run: ${harnessProblem}`
            : `${entry.note}; test suite could not run: ${harnessProblem}`,
      }));
    }

    const repairable = tests.failedFiles
      .map((file) => ownerOf.get(file))
      .filter((task): task is PlannedTask => task !== undefined)
      // A task already out of budget does not get a second allowance here.
      .filter((task) => {
        const outcome = merged.find((entry) => entry.taskId === task.id);
        return outcome?.status !== "degraded" && outcome?.status !== "failed";
      });

    if (repairable.length === 0) {
      options.onProgress(
        "tests",
        `failing, and no in-budget task owns the failures — leaving them reported`,
      );
      return merged;
    }

    options.onProgress(
      "tests",
      `${tests.failedFiles.length} file(s) failing, repairing ${repairable.length} (round ${attempt})`,
    );

    // The outer loop must check both tiers, not just the one that triggered it.
    // A test repair is still code: it can satisfy the assertion and break the
    // compiler on the way, and a run once finished with a clean generation phase
    // and two type errors introduced entirely by test repairs. Folding the
    // task's own type diagnostics into the payload lets the next round fix both
    // at once instead of trading one failure for the other.
    const typeState = await typecheck(cwd);

    for (const task of repairable) {
      const previous = await Promise.all(
        task.targetFiles.map(async (path) => ({
          path,
          contents: await context.fs.read(path).catch(() => ""),
          exports: [] as string[],
        })),
      );

      const ownTypeErrors = diagnosticsForFiles(typeState.diagnostics, task.targetFiles);
      const payload = [
        ownTypeErrors.length > 0
          ? `Type errors in your own file — fix these too:\n${formatDiagnostics(ownTypeErrors)}`
          : "",
        `Test run output:\n${tests.output}`,
      ]
        .filter((section) => section !== "")
        .join("\n\n");

      try {
        await repairTask(client, ledger, context, task, previous, payload, attempt);
        const index = merged.findIndex((entry) => entry.taskId === task.id);
        const existing = merged[index];
        if (index >= 0 && existing !== undefined) {
          merged[index] = {
            ...existing,
            status: "repaired",
            repairAttempts: existing.repairAttempts + 1,
            note: `repaired after failing tests (round ${attempt})`,
          };
        }
      } catch (error) {
        if (!(error instanceof GenerationContractError)) throw error;
        options.onProgress("repair", `${task.id}: rejected off-contract test repair`);
      }
    }
  }

  const finalTests = await runTests(cwd);
  if (!finalTests.ok) {
    for (const file of finalTests.failedFiles) {
      const task = ownerOf.get(file);
      if (task === undefined) continue;

      const index = merged.findIndex((entry) => entry.taskId === task.id);
      const existing = merged[index];
      if (index >= 0 && existing !== undefined && existing.status !== "failed") {
        merged[index] = {
          ...existing,
          status: "degraded",
          unresolved: [...existing.unresolved, `tests still failing in ${file}`],
          note:
            `tests fail after ${options.maxRepairs} round(s). If the test is correct, the ` +
            `defect is in a file this task does not own: ${task.dependsOn.join(", ") || "(no dependencies)"}`,
        };
      }
    }
  }

  return merged;
}

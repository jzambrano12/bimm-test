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
}

export interface RunOptions {
  readonly maxRepairs: number;
  readonly onProgress: (label: string, detail: string) => void;
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

  const finalTypecheck = await typecheck(cwd);
  const finalTests = await runTests(cwd);

  return {
    tasks: outerOutcomes,
    typecheckClean: finalTypecheck.ok,
    testsPassed: finalTests.ok,
    testOutput: finalTests.output,
    outstandingDiagnostics: finalTypecheck.diagnostics,
  };
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

    for (const task of repairable) {
      const previous = await Promise.all(
        task.targetFiles.map(async (path) => ({
          path,
          contents: await context.fs.read(path).catch(() => ""),
          exports: [] as string[],
        })),
      );

      try {
        await repairTask(client, ledger, context, task, previous, tests.output, attempt);
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

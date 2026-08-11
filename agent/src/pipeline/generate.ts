import type OpenAI from "openai";
import type { ArtifactRegistry } from "../context/artifacts.ts";
import { completeStructured } from "../llm/structured.ts";
import type { UsageLedger } from "../llm/usage.ts";
import {
  GENERATOR_SYSTEM,
  buildGeneratorUser,
  buildRepairUser,
  type GeneratorContext,
} from "../prompts/generator.ts";
import { GenerationResult, type GeneratedFile, type PlannedTask, type SpecRequirement } from "../schemas.ts";
import { ProjectFs } from "../tools/fs.ts";

export class GenerationContractError extends Error {}

/**
 * Removes a wrapping code fence from file contents.
 *
 * The prompt forbids fences, and the schema gives the model a string field
 * rather than a code block, so this should never fire. It exists because the
 * failure it prevents is silent: a file whose first line is ```tsx compiles
 * nowhere, and the resulting diagnostic points at syntax rather than at the
 * real cause, sending the repair loop chasing its own tail.
 */
export function stripCodeFence(contents: string): string {
  const trimmed = contents.trim();
  if (!trimmed.startsWith("```")) return contents;

  return trimmed
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```$/, "")
    .concat("\n");
}

/**
 * Checks the generation against the task's own contract before anything is
 * written: the declared files, all of them, and nothing else.
 *
 * This is the cheapest tier of validation — pure string comparison, no compiler,
 * no model. An off-contract path caught here costs nothing; caught later it
 * means an orphan file sitting in the output that no task owns and no
 * requirement explains.
 */
export function verifyAgainstTask(
  task: PlannedTask,
  files: readonly GeneratedFile[],
): readonly string[] {
  const problems: string[] = [];
  const produced = new Set(files.map((file) => file.path));
  const declared = new Set(task.targetFiles);

  for (const path of produced) {
    if (!declared.has(path)) {
      problems.push(`produced ${path}, which the task does not declare`);
    }
  }
  for (const path of declared) {
    if (!produced.has(path)) {
      problems.push(`did not produce declared file ${path}`);
    }
  }
  for (const file of files) {
    if (file.contents.trim() === "") {
      problems.push(`${file.path} is empty`);
    }
    if (/\bTODO\b|\.\.\.\s*rest of|implement this/i.test(file.contents)) {
      problems.push(`${file.path} contains a placeholder instead of an implementation`);
    }
  }

  return problems;
}

export interface GenerationContext {
  readonly model: string;
  readonly contract: string;
  readonly styleReference: string;
  readonly requirements: readonly SpecRequirement[];
  /** Every task in the plan, so dependencies resolve to their planned interface. */
  readonly tasksById: ReadonlyMap<string, PlannedTask>;
  readonly registry: ArtifactRegistry;
  readonly fs: ProjectFs;
}

/**
 * Keeps the task's purpose in the prompt alongside its mechanics.
 *
 * A task title and its acceptance criteria describe *what* to build; the
 * requirement it serves describes *why*, in the spec's own words. Including it
 * is what stops a generation technically satisfying its criteria while missing
 * the point of the feature.
 */
export function renderRequirementContext(
  task: PlannedTask,
  requirements: readonly SpecRequirement[],
): string {
  const cited = requirements.filter((requirement) => task.satisfies.includes(requirement.id));
  if (cited.length === 0) return "";

  return [
    "## Requirements this task serves (from the specification)",
    "",
    ...cited.map(
      (requirement) =>
        `- ${requirement.text}${requirement.required ? "" : " (optional in the spec)"}`,
    ),
  ].join("\n");
}

export function buildGeneratorContext(task: PlannedTask, context: GenerationContext): GeneratorContext {
  const dependencies = task.dependsOn
    .map((id) => context.tasksById.get(id))
    .filter((dependency): dependency is PlannedTask => dependency !== undefined);

  return {
    contract: context.contract,
    styleReference: context.styleReference,
    dependencyContext: context.registry.renderDependencyContext(dependencies),
    requirementContext: renderRequirementContext(task, context.requirements),
  };
}

/**
 * One generation attempt for one task: prompt, verify the shape, write, record.
 *
 * Deliberately does not retry. Retrying is the repair loop's job, and it needs
 * the diagnostics from the typecheck to do it well — a blind re-roll here would
 * spend a call to produce a second guess with no more information than the
 * first.
 */
export async function generateTask(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  task: PlannedTask,
): Promise<readonly GeneratedFile[]> {
  const result = await completeStructured(client, ledger, {
    model: context.model,
    phase: "generate",
    system: GENERATOR_SYSTEM,
    user: buildGeneratorUser(task, buildGeneratorContext(task, context)),
    schema: GenerationResult,
    schemaName: "GenerationResult",
  });

  const files = result.files.map((file) => ({
    ...file,
    contents: stripCodeFence(file.contents),
  }));

  const problems = verifyAgainstTask(task, files);
  if (problems.length > 0) {
    throw new GenerationContractError(
      `task "${task.id}" produced an off-contract result:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
  }

  return persist(context, task, files);
}

async function persist(
  context: GenerationContext,
  task: PlannedTask,
  files: readonly GeneratedFile[],
): Promise<readonly GeneratedFile[]> {
  for (const file of files) {
    await context.fs.write(file.path, file.contents);
  }
  context.registry.record(task.id, files);
  return files;
}

/**
 * One repair attempt: the same generator role, given what it produced and what
 * went wrong.
 *
 * `diagnostics` must already be scoped to this task's files. Passing the whole
 * project's errors would invite the model to reach outside its own task, and the
 * files it does not own are not writable to it anyway — it would simply fail
 * again, having spent a call.
 */
export async function repairTask(
  client: OpenAI,
  ledger: UsageLedger,
  context: GenerationContext,
  task: PlannedTask,
  previous: readonly GeneratedFile[],
  diagnostics: string,
  attempt: number,
): Promise<readonly GeneratedFile[]> {
  const result = await completeStructured(client, ledger, {
    model: context.model,
    phase: "repair",
    system: GENERATOR_SYSTEM,
    user: buildRepairUser(
      task,
      buildGeneratorContext(task, context),
      previous.map((file) => ({ path: file.path, contents: file.contents })),
      diagnostics,
      attempt,
    ),
    schema: GenerationResult,
    schemaName: "GenerationResult",
  });

  const files = result.files.map((file) => ({
    ...file,
    contents: stripCodeFence(file.contents),
  }));

  // A repair that drifts off contract is worse than no repair: it would leave
  // the previous, merely-broken files replaced by unrelated ones.
  const problems = verifyAgainstTask(task, files);
  if (problems.length > 0) {
    throw new GenerationContractError(
      `repair of "${task.id}" produced an off-contract result:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
  }

  return persist(context, task, files);
}

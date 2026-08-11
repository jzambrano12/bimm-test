#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, ConfigError } from "./config.ts";
import { ArtifactRegistry } from "./context/artifacts.ts";
import {
  buildContractDigest,
  ContractError,
  renderContract,
  renderStyleReference,
} from "./context/repoMap.ts";
import { createLlmClient, resolveModels, ModelResolutionError } from "./llm/client.ts";
import { LlmError } from "./llm/complete.ts";
import { StructuredOutputError } from "./llm/structured.ts";
import { PromptCache } from "./llm/cache.ts";
import { UsageLedger } from "./llm/usage.ts";
import { GenerationContractError } from "./pipeline/generate.ts";
import { createPlan, PlanValidationError, renderPlan } from "./pipeline/plan.ts";
import { executePlan } from "./pipeline/run.ts";
import { ProjectFs, SandboxViolationError } from "./tools/fs.ts";
import { estimateCost, renderCostLines, writeRunArtifacts } from "./report.ts";
import { boilerplateRoot, scaffold, ScaffoldError } from "./tools/scaffold.ts";

const ledger = new UsageLedger();

/**
 * Lighter models this key can reach, captured at preflight so the quota-exhausted
 * error path can name concrete alternatives instead of shrugging.
 */
let quotaFallbacks: readonly string[] = [];

/** Progress goes to stderr so stdout stays the plan and the report. */
function log(label: string, detail: string): void {
  process.stderr.write(`  ${label.padEnd(14)} ${detail}\n`);
}

/**
 * Paths that the user probably meant.
 *
 * With two valid entry points, mixing up their relative forms is the easy
 * mistake: `./agent/specs/x.md` is right from the repository root and wrong from
 * inside agent/, where it resolves one level too deep. The agent can see which
 * interpretation exists, so it says so instead of reporting a path and stopping.
 */
export function specSuggestions(requested: string): string[] {
  const root = boilerplateRoot();
  const name = basename(requested);

  const candidates = [
    // The same path read from the other entry point.
    requested.replace(`${sep}agent${sep}agent${sep}`, `${sep}agent${sep}`),
    join(root, "agent", "specs", name),
    join(root, "agent", name),
  ];

  return [...new Set(candidates)].filter(
    (candidate) => candidate !== requested && existsSync(candidate),
  );
}

async function readSpec(path: string): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    const suggestions = specSuggestions(path);
    throw new UsageError(
      `Cannot read spec file: ${path}` +
        (suggestions.length === 0
          ? ""
          : `\n\nDid you mean one of these? Relative paths are resolved from the ` +
            `directory you ran the command in.\n` +
            suggestions.map((candidate) => `  ${candidate}`).join("\n")),
    );
  }

  if (raw.trim() === "") {
    throw new UsageError(`Spec file is empty: ${path}`);
  }
  return raw;
}

const USAGE = `
car-inventory-agent — spec-driven code generation into a React + TS boilerplate

USAGE
  npm run agent -- --spec <file> [options]

  Works from the repository root or from agent/. Paths are relative to wherever
  you run it; --output defaults to generated-app/ beside the boilerplate either way.

REQUIRED
  --spec <file>          Natural-language specification to implement.

OPTIONS
  --output <dir>         Where to generate the app.
                         Default: generated-app/ beside the boilerplate.
  --dry-run              Plan only: print the task DAG and exit without generating.
  --resume               Reuse an existing output directory instead of re-scaffolding.
  --max-repairs <n>      Repair attempts per task before marking it degraded. Default: 3
  --concurrency <n>      Concurrent LLM calls per topological level. Default: 2
  --no-cache             Bypass the on-disk prompt cache.
  --no-review            Skip the spec-compliance review stage (saves one call).
  --keep-examples        Keep the boilerplate's Example.tsx reference files.
  -h, --help             Show this help.

ENVIRONMENT
  Requires an API key in agent/.env — see agent/.env.example.

EXAMPLES
  from the repository root:
    npm run agent -- --spec ./agent/specs/car-inventory.spec.md --dry-run
  from agent/:
    npm run agent -- --spec ./specs/car-inventory.spec.md
    npm run agent -- --spec ./specs/variant.spec.md --dry-run
`.trimStart();

export interface CliOptions {
  readonly specPath: string;
  readonly outputDir: string;
  /** True when --output was not given, so it defaulted beside the boilerplate. */
  readonly outputDefaulted: boolean;
  readonly dryRun: boolean;
  readonly resume: boolean;
  readonly keepExamples: boolean;
  readonly maxRepairsOverride: number | undefined;
  readonly concurrencyOverride: number | undefined;
  readonly cacheDisabled: boolean;
  readonly reviewDisabled: boolean;
}

export class UsageError extends Error {}

function takeValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

function takeInt(argv: readonly string[], index: number, flag: string): number {
  const raw = takeValue(argv, index, flag);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new UsageError(`${flag} requires a non-negative integer, got ${JSON.stringify(raw)}`);
  }
  return parsed;
}

/**
 * The directory the user typed the command in.
 *
 * npm sets INIT_CWD to the invocation directory, which differs from cwd when a
 * script delegates across packages: the root passthrough runs with cwd inside
 * agent/, so a relative --spec typed at the repo root would otherwise resolve
 * one level too deep. Honouring INIT_CWD makes a path mean what the person who
 * typed it meant, from either directory.
 */
function invocationCwd(): string {
  const initCwd = process.env["INIT_CWD"];
  return initCwd === undefined || initCwd.trim() === "" ? process.cwd() : initCwd;
}

/** Returns undefined when the user asked for help. */
export function parseArgs(argv: readonly string[], cwd = invocationCwd()): CliOptions | undefined {
  let specPath: string | undefined;
  let outputDir: string | undefined;
  let dryRun = false;
  let resume = false;
  let keepExamples = false;
  let maxRepairsOverride: number | undefined;
  let concurrencyOverride: number | undefined;
  let cacheDisabled = false;
  let reviewDisabled = false;

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case "-h":
      case "--help":
        return undefined;
      case "--spec":
        specPath = takeValue(argv, i, flag);
        i += 1;
        break;
      case "--output":
        outputDir = takeValue(argv, i, flag);
        i += 1;
        break;
      case "--max-repairs":
        maxRepairsOverride = takeInt(argv, i, flag);
        i += 1;
        break;
      case "--concurrency":
        concurrencyOverride = takeInt(argv, i, flag);
        i += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--resume":
        resume = true;
        break;
      case "--no-cache":
        cacheDisabled = true;
        break;
      case "--no-review":
        reviewDisabled = true;
        break;
      case "--keep-examples":
        keepExamples = true;
        break;
      default:
        throw new UsageError(`Unknown argument: ${String(flag)}`);
    }
  }

  if (specPath === undefined) {
    throw new UsageError("--spec is required");
  }

  return {
    specPath: resolve(cwd, specPath),
    // Defaulted output is anchored to the boilerplate rather than to the shell's
    // location, so `--output` omitted means the same directory wherever the
    // command was run from. A cwd-relative default silently pointed outside the
    // repository when invoked from the root.
    outputDir:
      outputDir === undefined
        ? join(boilerplateRoot(), "generated-app")
        : resolve(cwd, outputDir),
    outputDefaulted: outputDir === undefined,
    dryRun,
    resume,
    keepExamples,
    maxRepairsOverride,
    concurrencyOverride,
    cacheDisabled,
    reviewDisabled,
  };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options === undefined) {
    process.stdout.write(USAGE);
    return 0;
  }

  const startedAt = Date.now();
  const spec = await readSpec(options.specPath);
  const config = loadConfig();
  const client = createLlmClient(config);

  // Preflight before any generation work: validates the credential and the
  // model in one cheap request, so a bad key fails in two seconds rather than
  // halfway through a run that has already written files.
  const models = await resolveModels(client, config);
  quotaFallbacks = models.lighterAlternatives;
  const sourceRoot = boilerplateRoot();

  log("provider", config.baseUrl);
  log("planner model", models.planner);
  log("worker model", models.worker + (models.workerAutoSelected ? " (auto-selected)" : ""));
  log("spec", options.specPath);

  // Read from the pristine boilerplate rather than the copy, so planning never
  // depends on the output directory existing. That is what lets --dry-run do
  // no filesystem work at all.
  const digest = await buildContractDigest(sourceRoot);
  const contract = renderContract(digest);

  const cache = new PromptCache(
    resolve(import.meta.dirname, "..", ".cache"),
    !options.cacheDisabled && config.cacheEnabled,
  );

  const ordered = await createPlan(client, ledger, {
    model: models.planner,
    spec,
    contract,
    cache,
  });

  process.stdout.write(`\n${renderPlan(ordered)}\n`);

  if (options.dryRun) {
    const { totals } = ledger.snapshot();
    process.stdout.write(
      `\ndry run: stopping before generation ` +
        `(${totals.calls} LLM call(s), ` +
        `${totals.promptTokens} prompt + ${totals.completionTokens} completion tokens)\n`,
    );
    return 0;
  }

  const scaffolded = await scaffold({
    sourceRoot,
    targetRoot: options.outputDir,
    resume: options.resume,
  });
  log(
    "scaffold",
    scaffolded.reused
      ? `reusing ${options.outputDir}`
      : `${scaffolded.entriesCopied} entries into ${options.outputDir}` +
          `${scaffolded.nodeModulesPreserved ? " (node_modules preserved)" : ""}`,
  );

  const registry = new ArtifactRegistry();
  const context = {
    model: models.worker,
    contract,
    styleReference: renderStyleReference(digest),
    requirements: ordered.plan.requirements,
    tasksById: new Map(ordered.plan.tasks.map((task) => [task.id, task])),
    registry,
    fs: new ProjectFs(options.outputDir),
    cache,
  };

  process.stderr.write("\n");
  const outcome = await executePlan(client, ledger, context, ordered, options.outputDir, {
    maxRepairs: options.maxRepairsOverride ?? config.maxRepairs,
    keepExamples: options.keepExamples,
    concurrency: options.concurrencyOverride ?? config.concurrency,
    spec,
    reviewModel: models.planner,
    skipReview: options.reviewDisabled,
    onProgress: log,
  });

  const usage = ledger.snapshot();
  const { totals } = usage;
  const cost = estimateCost(models.worker, usage);
  const degraded = outcome.tasks.filter(
    (task) => task.status === "degraded" || task.status === "failed",
  );

  const artifacts = await writeRunArtifacts(options.outputDir, {
    spec: options.specPath,
    outputDir: options.outputDir,
    provider: config.baseUrl,
    plannerModel: models.planner,
    workerModel: models.worker,
    usage,
    cost,
    cache: cache.stats(),
    ordered,
    outcome,
    durationMs: Date.now() - startedAt,
  });

  const report = [
    "",
    `Files written:   ${registry.paths().length}`,
    `Typecheck:       ${outcome.typecheckClean ? "clean" : `${outcome.outstandingDiagnostics.length} error(s)`}`,
    `Tests:           ${outcome.testsPassed ? "passing" : "failing"}`,
    `LLM calls:       ${totals.calls} (${totals.promptTokens + totals.completionTokens} tokens)` +
      (totals.cacheHits > 0 ? `, ${totals.cacheHits} served from cache` : ""),
    ...renderCostLines(usage, cost),
    "",
    "Tasks:",
    ...outcome.tasks.map(
      (task) =>
        `  [${task.status}] ${task.taskId}${task.note === "" ? "" : ` — ${task.note}`}`,
    ),
  ];

  if (outcome.review !== undefined) {
    const { review } = outcome;
    const counts = { satisfied: 0, partial: 0, missing: 0 };
    for (const finding of review.findings) counts[finding.status] += 1;

    report.push(
      "",
      `Spec compliance:  ${counts.satisfied} satisfied, ${counts.partial} partial, ${counts.missing} missing`,
      `  ${review.assessment}`,
    );

    if (review.downgraded.length > 0) {
      report.push(
        `  audit: downgraded ${review.downgraded.join(", ")} — claimed satisfied without citing the spec's values`,
      );
    }

    const notSatisfied = review.findings.filter((finding) => finding.status !== "satisfied");
    if (notSatisfied.length > 0) {
      report.push("", "Requirements not fully met:");
      for (const finding of notSatisfied) {
        report.push(`  [${finding.status}] ${finding.requirementId}`);
        report.push(`    ${finding.evidence}`);
      }
    }
  }

  if (degraded.length > 0) {
    report.push("", `Unfinished work (${degraded.length} task(s)):`);
    for (const task of degraded) {
      report.push(`  ${task.taskId}:`);
      for (const problem of task.unresolved) report.push(`    ${problem}`);
    }
  }

  if (ordered.warnings.length > 0) {
    report.push("", "Plan warnings:", ...ordered.warnings.map((warning) => `  ${warning}`));
  }

  report.push(
    "",
    "Artifacts:",
    ...artifacts.map((path) => `  ${path}`),
  );

  process.stdout.write(`${report.join("\n")}\n`);

  // A run that could not finish everything reports it in the exit code too, so a
  // scripted caller does not have to parse prose to find out.
  return outcome.typecheckClean && outcome.testsPassed && degraded.length === 0 ? 0 : 1;
}

/**
 * True when this file is the process entrypoint rather than an import.
 *
 * Without this guard the module ran `main()` on import, so importing it to test
 * argument parsing executed the agent and called process.exit — which is why the
 * flag parsing went untested for so long. A CLI should still be a module.
 */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

export async function run(): Promise<number> {
    return main().catch((error: unknown) => {
    if (error instanceof UsageError) {
    process.stderr.write(`error: ${error.message}\n\n${USAGE}`);
    return 2;
    }
  if (
    error instanceof ConfigError ||
    error instanceof ModelResolutionError ||
    error instanceof ContractError
  ) {
    process.stderr.write(`configuration error: ${error.message}\n`);
    return 78; // EX_CONFIG
    }
    if (error instanceof PlanValidationError || error instanceof StructuredOutputError) {
    process.stderr.write(`planning failed: ${error.message}\n`);
    return 65; // EX_DATAERR
    }
    if (error instanceof ScaffoldError) {
    process.stderr.write(`scaffold error: ${error.message}\n`);
    return 73; // EX_CANTCREAT
    }
    if (error instanceof GenerationContractError || error instanceof SandboxViolationError) {
    process.stderr.write(`generation error: ${error.message}\n`);
    return 65; // EX_DATAERR
    }
    if (error instanceof LlmError) {
    process.stderr.write(`provider error: ${error.message}\n`);

    // Free tiers meter each model separately, so an exhausted quota on one
    // model usually leaves a lighter sibling untouched. Suggesting the exact
    // ids this key can reach beats telling the user to go read a dashboard.
    if (!error.retryable && quotaFallbacks.length > 0) {
      process.stderr.write(
        `\nModels in your catalog with separate quota — retry with one of:\n` +
          quotaFallbacks.map((id) => `  LLM_MODEL=${id}`).join("\n") +
          `\n\nProgress is not lost: re-run with --resume to keep the generated app.\n`,
      );
    }
    return 69; // EX_UNAVAILABLE
    }
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    return 1;
    });
}

if (isDirectRun()) {
  process.exit(await run());
}

#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, ConfigError } from "./config.ts";
import { buildContractDigest, ContractError, renderContract } from "./context/repoMap.ts";
import { createLlmClient, resolveModels, ModelResolutionError } from "./llm/client.ts";
import { LlmError } from "./llm/complete.ts";
import { StructuredOutputError } from "./llm/structured.ts";
import { UsageLedger } from "./llm/usage.ts";
import { createPlan, PlanValidationError, renderPlan } from "./pipeline/plan.ts";
import { boilerplateRoot, scaffold, ScaffoldError } from "./tools/scaffold.ts";

const ledger = new UsageLedger();

/** Progress goes to stderr so stdout stays the plan and the report. */
function log(label: string, detail: string): void {
  process.stderr.write(`  ${label.padEnd(14)} ${detail}\n`);
}

async function readSpec(path: string): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new UsageError(`Cannot read spec file: ${path}`);
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

REQUIRED
  --spec <file>          Natural-language specification to implement.

OPTIONS
  --output <dir>         Where to generate the app. Default: ../generated-app
  --dry-run              Plan only: print the task DAG and exit without generating.
  --resume               Reuse an existing output directory instead of re-scaffolding.
  --max-repairs <n>      Repair attempts per task before marking it degraded. Default: 3
  --concurrency <n>      Concurrent LLM calls per topological level. Default: 2
  --no-cache             Bypass the on-disk prompt cache.
  --keep-examples        Keep the boilerplate's Example.tsx reference files.
  -h, --help             Show this help.

ENVIRONMENT
  Requires an API key in agent/.env — see agent/.env.example.

EXAMPLES
  npm run agent -- --spec ./specs/car-inventory.spec.md
  npm run agent -- --spec ./specs/car-inventory.spec.md --dry-run
  npm run agent -- --spec ./specs/variant.spec.md --output ../variant-app
`.trimStart();

export interface CliOptions {
  readonly specPath: string;
  readonly outputDir: string;
  readonly dryRun: boolean;
  readonly resume: boolean;
  readonly keepExamples: boolean;
  readonly maxRepairsOverride: number | undefined;
  readonly concurrencyOverride: number | undefined;
  readonly cacheDisabled: boolean;
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

/** Returns undefined when the user asked for help. */
export function parseArgs(argv: readonly string[]): CliOptions | undefined {
  let specPath: string | undefined;
  let outputDir = "../generated-app";
  let dryRun = false;
  let resume = false;
  let keepExamples = false;
  let maxRepairsOverride: number | undefined;
  let concurrencyOverride: number | undefined;
  let cacheDisabled = false;

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
    specPath: resolve(specPath),
    outputDir: resolve(outputDir),
    dryRun,
    resume,
    keepExamples,
    maxRepairsOverride,
    concurrencyOverride,
    cacheDisabled,
  };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options === undefined) {
    process.stdout.write(USAGE);
    return 0;
  }

  const spec = await readSpec(options.specPath);
  const config = loadConfig();
  const client = createLlmClient(config);

  // Preflight before any generation work: validates the credential and the
  // model in one cheap request, so a bad key fails in two seconds rather than
  // halfway through a run that has already written files.
  const models = await resolveModels(client, config);
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

  const ordered = await createPlan(client, ledger, {
    model: models.planner,
    spec,
    contract,
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

  // Generation lands with the executor (ticket 8).
  return 0;
}

const exitCode = await main().catch((error: unknown) => {
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
  if (error instanceof LlmError) {
    process.stderr.write(`provider error: ${error.message}\n`);
    return 69; // EX_UNAVAILABLE
  }
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  return 1;
});

process.exit(exitCode);

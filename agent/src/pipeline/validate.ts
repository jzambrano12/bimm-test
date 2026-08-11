import { stat } from "node:fs/promises";
import { join } from "node:path";
import { combinedOutput, npmCommand, runCommand } from "../tools/shell.ts";

export interface Diagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
}

/** `src/App.tsx(24,5): error TS2339: Property 'x' does not exist on type 'Y'.` */
const DIAGNOSTIC_LINE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

/**
 * Parses tsc output into per-file diagnostics.
 *
 * Structured rather than passed through as text because attribution is the whole
 * point: a repair prompt must carry the errors for the file it owns and nothing
 * else. Handing a task another task's diagnostics invites it to "fix" files it
 * does not own, which is how one broken file becomes three.
 *
 * TypeScript continues long explanations on indented lines, so those are folded
 * into the preceding diagnostic instead of being dropped — the continuation is
 * usually where the actual type mismatch is spelled out.
 */
export function parseTypecheckOutput(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let current: { -readonly [K in keyof Diagnostic]: Diagnostic[K] } | undefined;

  for (const rawLine of output.split("\n")) {
    const match = DIAGNOSTIC_LINE.exec(rawLine.trimEnd());

    if (match) {
      const [, file, line, column, code, message] = match;
      if (file !== undefined && line !== undefined && column !== undefined && code !== undefined) {
        current = {
          file: file.trim().split("\\").join("/"),
          line: Number(line),
          column: Number(column),
          code,
          message: message ?? "",
        };
        diagnostics.push(current);
      }
      continue;
    }

    if (current !== undefined && /^\s+\S/.test(rawLine)) {
      current.message += `\n${rawLine.trim()}`;
    }
  }

  return diagnostics;
}

/** Diagnostics belonging to a specific set of files. */
export function diagnosticsForFiles(
  diagnostics: readonly Diagnostic[],
  files: readonly string[],
): Diagnostic[] {
  const owned = new Set(files);
  return diagnostics.filter((diagnostic) => owned.has(diagnostic.file));
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map(
      (diagnostic) =>
        `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code}: ${diagnostic.message}`,
    )
    .join("\n");
}

/**
 * Test files vitest reported as failing.
 *
 * Test output is deliberately kept as text rather than parsed into a structure:
 * the readable form is what goes into a repair prompt, and a bespoke parser for
 * a reporter's layout is a maintenance liability that buys nothing.
 */
export function parseFailedTestFiles(output: string): string[] {
  const failed = new Set<string>();
  const pattern = /(?:FAIL|❯)\s+(src\/[^\s:]+\.test\.tsx?)/g;

  for (const match of output.matchAll(pattern)) {
    const path = match[1];
    if (path !== undefined) failed.add(path);
  }
  return [...failed].sort();
}

export interface CommandOutcome {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

export interface TypecheckOutcome extends CommandOutcome {
  readonly diagnostics: readonly Diagnostic[];
}

export interface TestOutcome extends CommandOutcome {
  readonly failedFiles: readonly string[];
}

async function hasNodeModules(cwd: string): Promise<boolean> {
  try {
    await stat(join(cwd, "node_modules"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs dependencies if the generated app has none.
 *
 * Uses `npm install` rather than `npm ci` deliberately: the reviewer will run
 * `npm install` too, so validating against a different resolution than they get
 * would be validating the wrong tree.
 */
export async function ensureDependencies(cwd: string): Promise<CommandOutcome> {
  if (await hasNodeModules(cwd)) {
    return { ok: true, output: "node_modules already present", timedOut: false };
  }

  const result = await runCommand(npmCommand(), ["install", "--no-audit", "--no-fund"], {
    cwd,
    timeoutMs: 600_000,
  });

  return {
    ok: result.exitCode === 0,
    output: combinedOutput(result, 2_000),
    timedOut: result.timedOut,
  };
}

/**
 * Tier 1: the compiler.
 *
 * Runs on every task because it is fast, needs no test to exist yet, and catches
 * the class of error that actually dominates generated React — wrong prop
 * shapes, unused imports, unchecked index access.
 */
export async function typecheck(cwd: string): Promise<TypecheckOutcome> {
  const result = await runCommand(npmCommand(), ["run", "--silent", "typecheck"], {
    cwd,
    timeoutMs: 240_000,
  });

  const output = combinedOutput(result, 20_000);
  return {
    ok: result.exitCode === 0,
    output,
    timedOut: result.timedOut,
    diagnostics: parseTypecheckOutput(output),
  };
}

/**
 * Tier 2: the test suite.
 *
 * Runs once the graph is complete rather than after each task. Before that
 * point most test files do not exist and the components they cover are still
 * being written, so per-task test runs would mostly report failures that are
 * simply the future not having happened yet — and each run costs vitest's whole
 * startup.
 */
export async function runTests(cwd: string): Promise<TestOutcome> {
  const result = await runCommand(npmCommand(), ["run", "--silent", "test"], {
    cwd,
    timeoutMs: 300_000,
  });

  const output = combinedOutput(result, 20_000);
  return {
    ok: result.exitCode === 0,
    output,
    timedOut: result.timedOut,
    failedFiles: parseFailedTestFiles(output),
  };
}

import { spawn } from "node:child_process";

export interface ShellResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface ShellOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
}

/**
 * Combined output, truncated from the middle.
 *
 * Compiler and test output is fed back into prompts, so it has to be bounded.
 * Truncating the middle rather than the tail keeps both the first diagnostics
 * (usually the root cause) and the summary line (usually the count) — the two
 * parts a repair prompt actually needs.
 */
export function combinedOutput(result: ShellResult, maxChars = 6_000): string {
  const merged = [result.stdout, result.stderr].filter((part) => part.trim() !== "").join("\n");

  if (merged.length <= maxChars) return merged;

  const head = merged.slice(0, Math.floor(maxChars * 0.7));
  const tail = merged.slice(-Math.floor(maxChars * 0.3));
  const omitted = merged.length - head.length - tail.length;

  return `${head}\n\n… ${omitted} characters omitted …\n\n${tail}`;
}

/**
 * Runs a command to completion and returns its outcome as data.
 *
 * A non-zero exit is not an exception here: for this agent a failing typecheck
 * is the normal, expected signal that drives the repair loop, not an error
 * condition. Only the harness failing to run the process at all throws.
 */
export function runCommand(
  command: string,
  args: readonly string[],
  options: ShellOptions,
): Promise<ShellResult> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const started = Date.now();
  const printable = [command, ...args].join(" ");

  return new Promise<ShellResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      // Inherit the environment but never the API key: nothing the agent shells
      // out to has any business reading the credential.
      env: {
        ...process.env,
        GEMINI_API_KEY: undefined,
        GOOGLE_API_KEY: undefined,
        OPENAI_API_KEY: undefined,
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(new Error(`Failed to run \`${printable}\`: ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({
        command: printable,
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - started,
      });
    });
  });
}

/** npm, resolved for the current platform. */
export function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

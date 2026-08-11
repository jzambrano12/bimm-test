import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { combinedOutput, runCommand, type ShellResult } from "./shell.ts";

function fakeResult(stdout: string, stderr = ""): ShellResult {
  return {
    command: "fake",
    exitCode: 0,
    stdout,
    stderr,
    timedOut: false,
    durationMs: 0,
  };
}

describe("combinedOutput", () => {
  it("merges stdout and stderr", () => {
    expect(combinedOutput(fakeResult("out", "err"))).toBe("out\nerr");
  });

  it("omits an empty stream rather than leaving a blank line", () => {
    expect(combinedOutput(fakeResult("out", "   "))).toBe("out");
  });

  it("returns short output verbatim", () => {
    expect(combinedOutput(fakeResult("short"), 100)).toBe("short");
  });

  it("truncates the middle, keeping first diagnostics and the summary line", () => {
    const body = `FIRST${"x".repeat(5_000)}LAST`;
    const truncated = combinedOutput(fakeResult(body), 1_000);

    expect(truncated).toContain("FIRST");
    expect(truncated).toContain("LAST");
    expect(truncated).toContain("characters omitted");
    expect(truncated.length).toBeLessThan(body.length);
  });
});

describe("runCommand", () => {
  it("returns a non-zero exit as data, not an exception", async () => {
    const result = await runCommand("node", ["-e", "process.exit(3)"], { cwd: tmpdir() });
    expect(result.exitCode).toBe(3);
    expect(result.timedOut).toBe(false);
  });

  it("captures stdout and stderr separately", async () => {
    const result = await runCommand(
      "node",
      ["-e", "console.log('to-stdout'); console.error('to-stderr')"],
      { cwd: tmpdir() },
    );
    expect(result.stdout).toContain("to-stdout");
    expect(result.stderr).toContain("to-stderr");
  });

  it("kills a process that exceeds the timeout and flags it", async () => {
    const result = await runCommand("node", ["-e", "setTimeout(() => {}, 30_000)"], {
      cwd: tmpdir(),
      timeoutMs: 300,
    });
    expect(result.timedOut).toBe(true);
  });

  it("does not leak API credentials to child processes", async () => {
    process.env.GEMINI_API_KEY = "leak-canary";
    try {
      const result = await runCommand(
        "node",
        ["-e", "console.log(process.env.GEMINI_API_KEY ?? 'absent')"],
        { cwd: tmpdir() },
      );
      expect(result.stdout.trim()).toBe("absent");
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it("rejects when the binary does not exist", async () => {
    await expect(
      runCommand("definitely-not-a-real-binary-xyz", [], { cwd: tmpdir() }),
    ).rejects.toThrow(/Failed to run/);
  });
});

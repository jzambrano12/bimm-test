import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, specSuggestions, UsageError } from "./cli.ts";
import { boilerplateRoot } from "./tools/scaffold.ts";

describe("parseArgs", () => {
  const root = boilerplateRoot();
  const agentDir = join(root, "agent");

  it("returns undefined for --help", () => {
    expect(parseArgs(["--help"])).toBeUndefined();
    expect(parseArgs(["-h"])).toBeUndefined();
  });

  it("requires --spec", () => {
    expect(() => parseArgs([], agentDir)).toThrow(/--spec is required/);
  });

  it("rejects an unknown flag rather than ignoring it", () => {
    expect(() => parseArgs(["--spec", "s.md", "--typo"], agentDir)).toThrow(UsageError);
  });

  it("rejects a flag whose value is missing", () => {
    expect(() => parseArgs(["--spec", "--dry-run"], agentDir)).toThrow(/requires a value/);
  });

  it("rejects a non-numeric --max-repairs", () => {
    expect(() => parseArgs(["--spec", "s.md", "--max-repairs", "lots"], agentDir)).toThrow(
      /non-negative integer/,
    );
  });

  /**
   * The reason paths resolve against an explicit cwd: the root package delegates
   * to agent/, so npm runs the script with cwd inside agent/ while the user typed
   * their path at the root. Resolving against process.cwd() sent it one level too
   * deep and reported a missing spec file for a path that was right there.
   */
  it("resolves --spec relative to where the command was typed", () => {
    const fromRoot = parseArgs(["--spec", "./agent/specs/car-inventory.spec.md"], root);
    const fromAgent = parseArgs(["--spec", "./specs/car-inventory.spec.md"], agentDir);

    expect(fromRoot?.specPath).toBe(join(agentDir, "specs/car-inventory.spec.md"));
    expect(fromRoot?.specPath).toBe(fromAgent?.specPath);
  });

  it("defaults --output beside the boilerplate, identically from either directory", () => {
    // A cwd-relative default ("../generated-app") pointed outside the repository
    // when the command ran from the root.
    const expected = join(root, "generated-app");

    expect(parseArgs(["--spec", "s.md"], root)?.outputDir).toBe(expected);
    expect(parseArgs(["--spec", "s.md"], agentDir)?.outputDir).toBe(expected);
  });

  it("resolves an explicit --output relative to where the command was typed", () => {
    const parsed = parseArgs(["--spec", "s.md", "--output", "./out"], root);
    expect(parsed?.outputDir).toBe(join(root, "out"));
    expect(parsed?.outputDefaulted).toBe(false);
  });

  it("parses the boolean flags", () => {
    const parsed = parseArgs(
      ["--spec", "s.md", "--dry-run", "--resume", "--no-cache", "--no-review", "--keep-examples"],
      agentDir,
    );

    expect(parsed).toMatchObject({
      dryRun: true,
      resume: true,
      cacheDisabled: true,
      reviewDisabled: true,
      keepExamples: true,
    });
  });

  it("leaves overrides undefined when not given, so config defaults apply", () => {
    const parsed = parseArgs(["--spec", "s.md"], agentDir);
    expect(parsed?.maxRepairsOverride).toBeUndefined();
    expect(parsed?.concurrencyOverride).toBeUndefined();
  });
});

describe("specSuggestions", () => {
  const root = boilerplateRoot();

  /**
   * The mistake two entry points invite, hit twice in practice:
   * `./agent/specs/x.md` is correct from the repository root and one level too
   * deep from inside agent/. The agent can see which reading exists, so it says
   * so rather than printing a path and stopping.
   */
  it("suggests the shallower path when agent/ was doubled", () => {
    const doubled = join(root, "agent", "agent", "specs", "car-inventory.spec.md");
    expect(specSuggestions(doubled)).toContain(
      join(root, "agent", "specs", "car-inventory.spec.md"),
    );
  });

  it("finds a spec by name when the directory was wrong", () => {
    const wrongDir = join(root, "specs", "variant.spec.md");
    expect(specSuggestions(wrongDir)).toContain(join(root, "agent", "specs", "variant.spec.md"));
  });

  it("suggests nothing for a spec that genuinely does not exist", () => {
    expect(specSuggestions(join(root, "agent", "specs", "invented.spec.md"))).toEqual([]);
  });

  it("never suggests the path that was already tried", () => {
    const real = join(root, "agent", "specs", "car-inventory.spec.md");
    expect(specSuggestions(real)).not.toContain(real);
  });
});

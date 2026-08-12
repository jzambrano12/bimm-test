import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ScaffoldError, boilerplateRoot, scaffold } from "./scaffold.ts";

/** A minimal stand-in for the provided boilerplate layout. */
async function makeFakeBoilerplate(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agent-boilerplate-"));

  await writeFile(join(root, "index.html"), "<html></html>");
  // Mirrors the real root: app scripts alongside the two that drive the agent
  // workspace, which must not survive into a generated app.
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "car-inventory-boilerplate",
      scripts: {
        agent: "npm --prefix ./agent run agent --",
        "agent:install": "npm --prefix ./agent install",
        dev: "vite",
        build: "tsc -b && vite build",
        test: "vitest run",
        typecheck: "tsc --noEmit",
      },
    }),
  );
  await writeFile(join(root, "package-lock.json"), "{}");
  await writeFile(join(root, "tsconfig.json"), "{}");
  await writeFile(join(root, "vite.config.ts"), "export default {};");
  await writeFile(join(root, "vitest.config.ts"), "export default {};");
  await writeFile(join(root, "vite-env.d.ts"), "");
  await writeFile(join(root, ".gitignore"), "node_modules");
  await mkdir(join(root, "public"), { recursive: true });
  await writeFile(join(root, "public", "mockServiceWorker.js"), "// worker");
  await mkdir(join(root, "src", "mocks"), { recursive: true });
  await writeFile(join(root, "src", "App.tsx"), "export default function App() {}");
  await writeFile(join(root, "src", "mocks", "handlers.ts"), "export const handlers = [];");

  // Things that must never be copied into the generated app.
  await writeFile(join(root, "README.md"), "challenge instructions");
  await writeFile(join(root, ".env.example"), "GEMINI_API_KEY=");
  await mkdir(join(root, "agent"), { recursive: true });
  await writeFile(join(root, "agent", "package.json"), "{}");

  return root;
}

describe("boilerplateRoot", () => {
  /**
   * Asserted structurally rather than by directory name. An earlier version
   * expected the checkout to be called "Fullstack-Coding-Challenge-main", which
   * passed here and failed in a fresh clone under any other name — including
   * every clone a reviewer would make.
   */
  it("resolves to the directory that contains the agent workspace", () => {
    expect(boilerplateRoot()).toBe(resolve(import.meta.dirname, "..", "..", ".."));
  });

  it("points at a directory that really holds the boilerplate", () => {
    const root = boilerplateRoot();
    for (const marker of ["package.json", "src/types.ts", "src/graphql/queries.ts", "agent"]) {
      expect(existsSync(join(root, marker)), `${marker} missing from ${root}`).toBe(true);
    }
  });
});

describe("scaffold", () => {
  let sourceRoot: string;
  let workDir: string;

  beforeEach(async () => {
    sourceRoot = await makeFakeBoilerplate();
    workDir = await mkdtemp(join(tmpdir(), "agent-out-"));
  });

  it("copies the allowlisted boilerplate contents", async () => {
    const targetRoot = join(workDir, "generated-app");
    const result = await scaffold({ sourceRoot, targetRoot, resume: false });

    expect(result.reused).toBe(false);
    expect(await readdir(join(targetRoot, "src"))).toContain("App.tsx");
    expect(await readdir(join(targetRoot, "src", "mocks"))).toContain("handlers.ts");
    expect(await readdir(join(targetRoot, "public"))).toContain("mockServiceWorker.js");
  });

  it("excludes the agent workspace, README and .env.example", async () => {
    const targetRoot = join(workDir, "generated-app");
    await scaffold({ sourceRoot, targetRoot, resume: false });

    const entries = await readdir(targetRoot);
    expect(entries).not.toContain("agent");
    expect(entries).not.toContain("README.md");
    expect(entries).not.toContain(".env.example");
  });

  /**
   * The agent workspace is excluded from the copy, so any script pointing at it
   * would ship broken — `npm run agent` in a generated app would look for an
   * ./agent that is not there. The app's own scripts must survive untouched.
   */
  it("strips scripts that drive the agent workspace, keeping the app's own", async () => {
    const targetRoot = join(workDir, "generated-app");
    await scaffold({ sourceRoot, targetRoot, resume: false });

    const pkg = JSON.parse(await readFile(join(targetRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(Object.keys(pkg.scripts)).toEqual(["dev", "build", "test", "typecheck"]);
    expect(pkg.scripts["build"]).toBe("tsc -b && vite build");
  });

  it("leaves a boilerplate with no scripts alone", async () => {
    await writeFile(join(sourceRoot, "package.json"), '{"name":"car-inventory-boilerplate"}');
    const targetRoot = join(workDir, "generated-app");

    await expect(scaffold({ sourceRoot, targetRoot, resume: false })).resolves.toMatchObject({
      reused: false,
    });
  });

  it("does not copy the output directory into itself when nested in the source", async () => {
    // The real default: --output ../generated-app, inside the boilerplate root.
    const targetRoot = join(sourceRoot, "generated-app");
    await scaffold({ sourceRoot, targetRoot, resume: false });
    await scaffold({ sourceRoot, targetRoot, resume: false });

    expect(await readdir(targetRoot)).not.toContain("generated-app");
  });

  it("writes a marker that authorises a later reset", async () => {
    const targetRoot = join(workDir, "generated-app");
    await scaffold({ sourceRoot, targetRoot, resume: false });
    expect(await readdir(targetRoot)).toContain(".agent-generated");
  });

  it("refuses to clobber a directory it did not create", async () => {
    const targetRoot = join(workDir, "someones-work");
    await mkdir(targetRoot, { recursive: true });
    await writeFile(join(targetRoot, "thesis.txt"), "years of effort");

    await expect(scaffold({ sourceRoot, targetRoot, resume: false })).rejects.toThrow(ScaffoldError);
    expect(await readdir(targetRoot)).toContain("thesis.txt");
  });

  it("resets a directory it did create", async () => {
    const targetRoot = join(workDir, "generated-app");
    await scaffold({ sourceRoot, targetRoot, resume: false });
    await writeFile(join(targetRoot, "src", "stale.ts"), "from a previous run");

    await scaffold({ sourceRoot, targetRoot, resume: false });
    expect(await readdir(join(targetRoot, "src"))).not.toContain("stale.ts");
  });

  it("preserves node_modules across a reset so re-runs stay fast", async () => {
    const targetRoot = join(workDir, "generated-app");
    await scaffold({ sourceRoot, targetRoot, resume: false });
    await mkdir(join(targetRoot, "node_modules", "react"), { recursive: true });

    const result = await scaffold({ sourceRoot, targetRoot, resume: false });
    expect(result.nodeModulesPreserved).toBe(true);
    expect(await readdir(join(targetRoot, "node_modules"))).toContain("react");
  });

  it("accepts an empty existing directory", async () => {
    const targetRoot = join(workDir, "empty");
    await mkdir(targetRoot, { recursive: true });
    await expect(scaffold({ sourceRoot, targetRoot, resume: false })).resolves.toBeDefined();
  });

  it("refuses to generate into the boilerplate root itself", async () => {
    await expect(
      scaffold({ sourceRoot, targetRoot: sourceRoot, resume: false }),
    ).rejects.toThrow(/must not be the boilerplate root/);
  });

  it("fails clearly when the boilerplate is missing an expected entry", async () => {
    const incomplete = await mkdtemp(join(tmpdir(), "agent-incomplete-"));
    await writeFile(join(incomplete, "index.html"), "<html></html>");

    await expect(
      scaffold({ sourceRoot: incomplete, targetRoot: join(workDir, "out"), resume: false }),
    ).rejects.toThrow(/missing package.json/);
  });

  describe("--resume", () => {
    it("reuses an existing generated app without copying", async () => {
      const targetRoot = join(workDir, "generated-app");
      await scaffold({ sourceRoot, targetRoot, resume: false });
      await writeFile(join(targetRoot, "src", "keep-me.ts"), "prior progress");

      const result = await scaffold({ sourceRoot, targetRoot, resume: true });
      expect(result.reused).toBe(true);
      expect(await readdir(join(targetRoot, "src"))).toContain("keep-me.ts");
    });

    it("fails when the target does not exist", async () => {
      await expect(
        scaffold({ sourceRoot, targetRoot: join(workDir, "nope"), resume: true }),
      ).rejects.toThrow(/does not exist/);
    });

    it("fails when the target is not a generated app", async () => {
      const targetRoot = join(workDir, "random");
      await mkdir(targetRoot, { recursive: true });
      await writeFile(join(targetRoot, "notes.txt"), "not an app");

      await expect(scaffold({ sourceRoot, targetRoot, resume: true })).rejects.toThrow(
        /no package.json/,
      );
    });
  });
});

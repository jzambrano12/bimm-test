import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ProjectFs, SandboxViolationError, checkWritable } from "./fs.ts";

describe("checkWritable", () => {
  it.each([
    "src/App.tsx",
    "src/hooks/useCars.ts",
    "src/components/CarCard.tsx",
    "src/__tests__/CarCard.test.tsx",
    "src/utils/responsive.ts",
  ])("allows %s", (path) => {
    expect(checkWritable(path).allowed).toBe(true);
  });

  it.each([
    ["src/graphql/queries.ts", "provided GraphQL documents"],
    ["src/graphql/client.ts", "provided Apollo client"],
    ["src/mocks/handlers.ts", "provided MSW handlers"],
    ["src/mocks/data.ts", "provided seed data"],
    ["src/types.ts", "provided Car type"],
    ["src/main.tsx", "provided app bootstrap"],
    ["src/test-setup.ts", "provided MSW test lifecycle"],
  ])("refuses %s (%s)", (path) => {
    expect(checkWritable(path).allowed).toBe(false);
  });

  it.each([
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "vitest.config.ts",
    "index.html",
    "public/mockServiceWorker.js",
    ".env.example",
  ])("refuses %s because it is outside src/", (path) => {
    const decision = checkWritable(path);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/restricted to src\//);
  });

  it.each([
    "../package.json",
    "../../etc/passwd",
    "src/../package.json",
    "src/components/../../vite.config.ts",
  ])("refuses traversal attempt %s", (path) => {
    expect(checkWritable(path).allowed).toBe(false);
  });

  it("refuses absolute paths", () => {
    expect(checkWritable("/etc/passwd").allowed).toBe(false);
    expect(checkWritable("/tmp/src/App.tsx").allowed).toBe(false);
  });

  it("refuses an empty path", () => {
    expect(checkWritable("").allowed).toBe(false);
    expect(checkWritable("   ").allowed).toBe(false);
  });

  it("normalises redundant segments before deciding", () => {
    expect(checkWritable("src/./hooks/useCars.ts").allowed).toBe(true);
    expect(checkWritable("src/hooks/../graphql/queries.ts").allowed).toBe(false);
  });

  it("reports why, not just that, so the refusal can go back into a prompt", () => {
    expect(checkWritable("src/mocks/handlers.ts").reason).toMatch(/boilerplate/);
  });
});

describe("ProjectFs", () => {
  let root: string;
  let fs: ProjectFs;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "agent-fs-test-"));
    fs = new ProjectFs(root);
  });

  it("writes an allowed file, creating parent directories", async () => {
    await fs.write("src/hooks/useCars.ts", "export const useCars = () => {};\n");
    expect(await readFile(join(root, "src/hooks/useCars.ts"), "utf8")).toContain("useCars");
  });

  it("throws SandboxViolationError on a protected path and writes nothing", async () => {
    await expect(fs.write("src/mocks/handlers.ts", "wiped")).rejects.toThrow(
      SandboxViolationError,
    );
    expect(await fs.exists("src/mocks/handlers.ts")).toBe(false);
  });

  it("throws when writing outside src/", async () => {
    await expect(fs.write("package.json", "{}")).rejects.toThrow(SandboxViolationError);
  });

  it("permits reading a protected file — the contract must be readable to be honoured", async () => {
    await fs.write("src/hooks/x.ts", "export const x = 1;\n");
    expect(await fs.read("src/hooks/x.ts")).toContain("x = 1");
  });

  it("lists files relative to the root, skipping dotfiles", async () => {
    await fs.write("src/App.tsx", "a");
    await fs.write("src/components/CarCard.tsx", "b");
    expect(await fs.list("src")).toEqual(["src/App.tsx", "src/components/CarCard.tsx"]);
  });
});

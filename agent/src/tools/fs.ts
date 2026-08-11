import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

export class SandboxViolationError extends Error {}

/**
 * The only directory the agent may write into, relative to the generated app
 * root. Everything the spec asks for — hooks, components, tests, the app shell
 * — lives under src/, so a single allowlisted root also protects every config
 * file, the lockfile and the MSW worker without enumerating them.
 */
const WRITABLE_ROOT = "src";

/**
 * Files inside the writable root that are nonetheless off limits: the
 * boilerplate's provided contract.
 *
 * This is enforced here, in the tool layer, rather than asked for in a prompt.
 * The GraphQL documents, MSW handlers, seed data, Car type and Apollo/MUI
 * bootstrap are given; a generated app that rewrites them is not solving the
 * task, it is redefining it. A prompt instruction is a request the model may
 * decline under pressure — a rejected write is a guarantee.
 */
const PROTECTED_PREFIXES: readonly string[] = ["src/graphql/", "src/mocks/"];

const PROTECTED_FILES: readonly string[] = ["src/types.ts", "src/main.tsx", "src/test-setup.ts"];

export interface SandboxDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Pure path policy, separated from I/O so it is exhaustively testable.
 *
 * `path` is interpreted as relative to the generated app root. Absolute paths
 * and traversal are rejected outright rather than normalised into something
 * plausible — a generator emitting `../../etc` is confused, and quietly fixing
 * it hides the confusion.
 */
export function checkWritable(path: string): SandboxDecision {
  if (path.trim() === "") {
    return { allowed: false, reason: "empty path" };
  }
  if (isAbsolute(path)) {
    return { allowed: false, reason: `absolute paths are not allowed: ${path}` };
  }

  const normalized = normalize(path).split(sep).join("/");

  if (normalized.startsWith("../") || normalized === "..") {
    return { allowed: false, reason: `path escapes the project root: ${path}` };
  }
  if (!normalized.startsWith(`${WRITABLE_ROOT}/`)) {
    return {
      allowed: false,
      reason: `writes are restricted to ${WRITABLE_ROOT}/ — refused ${normalized}`,
    };
  }
  if (PROTECTED_FILES.includes(normalized)) {
    return {
      allowed: false,
      reason: `${normalized} is provided by the boilerplate and must not be modified`,
    };
  }
  for (const prefix of PROTECTED_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return {
        allowed: false,
        reason: `${prefix} is provided by the boilerplate and must not be modified (refused ${normalized})`,
      };
    }
  }

  return { allowed: true, reason: "" };
}

/** Every path the generator is forbidden to touch, for inclusion in prompts. */
export function protectedPathList(): readonly string[] {
  return [...PROTECTED_PREFIXES, ...PROTECTED_FILES];
}

/**
 * Filesystem access scoped to one generated app.
 *
 * Reads are permitted anywhere inside the root — the generator legitimately
 * needs to read the contract it must not rewrite. Only writes are policed.
 */
export class ProjectFs {
  constructor(private readonly root: string) {}

  private absolute(path: string): string {
    const abs = resolve(this.root, path);
    const rel = relative(this.root, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new SandboxViolationError(`path escapes the project root: ${path}`);
    }
    return abs;
  }

  async read(path: string): Promise<string> {
    return readFile(this.absolute(path), "utf8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await readFile(this.absolute(path));
      return true;
    } catch {
      return false;
    }
  }

  /** Throws SandboxViolationError if policy forbids the path. */
  async write(path: string, contents: string): Promise<void> {
    const decision = checkWritable(path);
    if (!decision.allowed) {
      throw new SandboxViolationError(decision.reason);
    }

    const abs = this.absolute(path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, "utf8");
  }

  async remove(path: string): Promise<void> {
    const decision = checkWritable(path);
    if (!decision.allowed) {
      throw new SandboxViolationError(decision.reason);
    }
    await rm(this.absolute(path), { force: true });
  }

  /** Recursive listing of repo-relative file paths, excluding node_modules. */
  async list(subdir = "."): Promise<string[]> {
    const start = this.absolute(subdir);
    const found: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else {
          found.push(relative(this.root, abs).split(sep).join("/"));
        }
      }
    };

    await walk(start);
    return found.sort();
  }
}

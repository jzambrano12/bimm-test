import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { protectedPathList } from "../tools/fs.ts";

export class ContractError extends Error {}

/**
 * What the boilerplate guarantees, extracted from the boilerplate itself.
 *
 * Every field here is derived from a real file rather than transcribed into a
 * constant. A hand-written digest is a second source of truth that drifts the
 * first time the template changes, and the failure mode is the worst kind: the
 * agent generates confidently against a contract that no longer exists.
 */
export interface ContractDigest {
  readonly carType: string;
  readonly graphqlOperations: string;
  readonly mockedOperations: readonly string[];
  readonly dependencies: readonly string[];
  readonly compilerRules: readonly string[];
  readonly pathAlias: string;
  readonly protectedPaths: readonly string[];
  readonly styleReference: string;
}

/**
 * What each enabled compiler flag actually means for emitted code.
 *
 * Keyed by flag so the rendered rules follow the boilerplate's real tsconfig.
 * These are the flags that silently fail generated React code — especially
 * noUncheckedIndexedAccess, which turns every array index into a union and is
 * the single most common reason a plausible-looking component fails typecheck.
 */
const FLAG_GUIDANCE: Readonly<Record<string, string>> = {
  strict: "Strict mode is on: no implicit any, and null/undefined are checked.",
  noUnusedLocals: "No unused variables or imports — an unused import fails the build.",
  noUnusedParameters:
    "No unused function parameters — prefix with _ only if the signature demands it.",
  noUncheckedIndexedAccess:
    "Indexed access yields `T | undefined`: `cars[0]` is possibly undefined, and so is " +
    "`array.find(...)`. Narrow before use; never assume an index is populated.",
  noFallthroughCasesInSwitch: "Every switch case must break or return.",
  exactOptionalPropertyTypes:
    "An optional property cannot be explicitly assigned undefined; omit it instead.",
  verbatimModuleSyntax: "Type-only imports must use `import type`.",
};

async function readText(root: string, relative: string): Promise<string> {
  try {
    return (await readFile(join(root, relative), "utf8")).trim();
  } catch {
    throw new ContractError(
      `Boilerplate is missing ${relative}. The agent derives its contract from the ` +
        `provided project and cannot proceed without it.`,
    );
  }
}

async function readJson(root: string, relative: string): Promise<Record<string, unknown>> {
  const raw = await readText(root, relative);
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new ContractError(
      `${relative} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Operation names MSW actually serves, so the generator cannot invent a query. */
function extractMockedOperations(handlersSource: string): string[] {
  const found = new Set<string>();
  const pattern = /graphql\.(query|mutation)\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;

  for (const match of handlersSource.matchAll(pattern)) {
    const kind = match[1];
    const name = match[2];
    if (kind !== undefined && name !== undefined) {
      found.add(`${name} (${kind})`);
    }
  }
  return [...found].sort();
}

function extractCompilerRules(tsconfig: Record<string, unknown>): string[] {
  const options = tsconfig["compilerOptions"];
  if (typeof options !== "object" || options === null) return [];

  const enabled = options as Record<string, unknown>;
  const rules: string[] = [];

  for (const [flag, guidance] of Object.entries(FLAG_GUIDANCE)) {
    if (enabled[flag] === true) rules.push(guidance);
  }

  if (enabled["jsx"] === "react-jsx") {
    rules.push("JSX runtime is automatic — do not import React just to use JSX.");
  }
  return rules;
}

function extractPathAlias(tsconfig: Record<string, unknown>): string {
  const options = tsconfig["compilerOptions"];
  if (typeof options !== "object" || options === null) return "";

  const paths = (options as Record<string, unknown>)["paths"];
  if (typeof paths !== "object" || paths === null) return "";

  return Object.entries(paths as Record<string, unknown>)
    .map(([alias, targets]) => `${alias} -> ${JSON.stringify(targets)}`)
    .join(", ");
}

function extractDependencies(pkg: Record<string, unknown>): string[] {
  const collected: string[] = [];

  for (const field of ["dependencies", "devDependencies"] as const) {
    const group = pkg[field];
    if (typeof group !== "object" || group === null) continue;

    for (const [name, version] of Object.entries(group as Record<string, unknown>)) {
      collected.push(`${name}@${String(version)}`);
    }
  }
  return collected.sort();
}

/**
 * Reads the boilerplate once, at startup. No LLM: this is file reading and
 * regex, and asking a model to summarise files we can simply quote would add
 * cost, latency and a chance of being wrong.
 */
export async function buildContractDigest(sourceRoot: string): Promise<ContractDigest> {
  const [carType, graphqlOperations, handlersSource, exampleComponent, exampleTest] =
    await Promise.all([
      readText(sourceRoot, "src/types.ts"),
      readText(sourceRoot, "src/graphql/queries.ts"),
      readText(sourceRoot, "src/mocks/handlers.ts"),
      readText(sourceRoot, "src/components/Example.tsx"),
      readText(sourceRoot, "src/__tests__/Example.test.tsx"),
    ]);

  const [tsconfig, pkg] = await Promise.all([
    readJson(sourceRoot, "tsconfig.json"),
    readJson(sourceRoot, "package.json"),
  ]);

  return {
    carType,
    graphqlOperations,
    mockedOperations: extractMockedOperations(handlersSource),
    dependencies: extractDependencies(pkg),
    compilerRules: extractCompilerRules(tsconfig),
    pathAlias: extractPathAlias(tsconfig),
    protectedPaths: protectedPathList(),
    styleReference: `// src/components/Example.tsx\n${exampleComponent}\n\n// src/__tests__/Example.test.tsx\n${exampleTest}`,
  };
}

/**
 * The invariant half of every prompt: what exists, what the rules are, what is
 * off limits. Contains no reference to the specification, which is what keeps
 * the agent spec-driven — swap the spec and this block is unchanged.
 */
export function renderContract(digest: ContractDigest): string {
  return [
    "## Existing project contract (already implemented — do not recreate)",
    "",
    "### Domain type (src/types.ts)",
    "```ts",
    digest.carType,
    "```",
    "",
    "### GraphQL documents (src/graphql/queries.ts) — import these, do not redefine them",
    "```ts",
    digest.graphqlOperations,
    "```",
    "",
    "### Operations served by the MSW mock",
    digest.mockedOperations.map((op) => `- ${op}`).join("\n"),
    "",
    "Only these operations exist. The mock keeps cars in memory, so an added car",
    "persists until reload, and AddCar generates its own mobile/tablet/desktop",
    "image URLs — callers must not supply them.",
    "",
    "### Already wired up, outside your reach",
    "- Apollo Client is configured and provided via ApolloProvider in src/main.tsx.",
    "- MUI ThemeProvider and CssBaseline are already mounted in src/main.tsx.",
    "- MSW runs in dev via src/main.tsx and in tests via src/test-setup.ts.",
    "",
    "### Files you must not create or modify",
    digest.protectedPaths.map((path) => `- ${path}`).join("\n"),
    "",
    "### Available dependencies (do not add any)",
    digest.dependencies.map((dep) => `- ${dep}`).join("\n"),
    "",
    "### Compiler rules your code must satisfy",
    digest.compilerRules.map((rule) => `- ${rule}`).join("\n"),
    `- Import alias: ${digest.pathAlias}`,
    "",
    "### Verification the generated code must pass",
    "- `npm run typecheck` (tsc --noEmit)",
    "- `npm run test` (vitest run)",
  ].join("\n");
}

/**
 * House style, by example rather than description.
 *
 * The boilerplate ships a reference component and test precisely to show the
 * expected idiom, which makes it the one legitimate few-shot example available:
 * it is the project's own code, so imitating it cannot drift from the target.
 * Generation prompts get this; the planner does not, since it writes no code.
 */
export function renderStyleReference(digest: ContractDigest): string {
  return [
    "## House style reference",
    "",
    "These files ship with the project to demonstrate the expected idiom for",
    "Apollo + MUI + Testing Library. Match their conventions. They are reference",
    "material and will be deleted from the final app, so do not import from them.",
    "",
    "```tsx",
    digest.styleReference,
    "```",
  ].join("\n");
}

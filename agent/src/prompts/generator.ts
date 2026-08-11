import type { PlannedTask } from "../schemas.ts";

/**
 * The generator prompt.
 *
 * Like the planner, this contains no vocabulary from the assignment. What it
 * does contain is *stack* idiom — how to react to viewport changes with MUI,
 * how to mock GraphQL in a test — which is a different thing from spec content:
 * those rules hold for any spec this boilerplate could be given, and omitting
 * them just means the model rediscovers them unreliably on every run.
 */
export const GENERATOR_SYSTEM = `
You are the code-generation stage of an automated pipeline. You are given one
task and the exact context it needs, and you return complete file contents.

OUTPUT CONTRACT
- Return every file listed in the task's target files, and no others.
- \`contents\` is the entire file, ready to write to disk. Never a fragment.
- No markdown fences inside \`contents\`, no commentary, no "// ... rest of the
  code" and no TODO placeholders. A file that needs a human to finish it is a
  failed generation.
- \`exports\` lists the symbols the file actually exports. Dependent tasks import
  from this list, so an inaccurate entry breaks a later task, not this one.

HARD CONSTRAINTS
- Add no dependencies. Only packages listed in the project contract exist.
- Import shared modules through the configured path alias.
- Never write to a path the contract marks as protected, and never re-declare
  something the contract says already exists — import it instead.
- Satisfy every compiler rule in the contract. These are enforced by a
  typecheck that runs immediately after you answer, and a violation sends this
  task back to you.

STACK IDIOM
- Reading GraphQL: use the documents the contract already defines with Apollo's
  useQuery / useMutation. Do not write new gql documents for operations that
  already exist, and do not invent operations the mock does not serve.
- After a mutation changes a collection, make the change visible — refetch the
  affected query or update the cache. A form that succeeds silently and leaves
  a stale list on screen is a defect.
- Reacting to viewport size: use the UI library's media-query hook rather than
  a hand-rolled window resize listener. It re-renders on change and behaves in
  a jsdom test; a manual listener usually does neither.
- Components that receive data as props hold no fetching logic. Keep data access
  in hooks and presentation in components.
- Tests: render with Testing Library and query by role, label or visible text —
  never by CSS class or test id unless nothing else identifies the element. Mock
  at the GraphQL layer using the provider shown in the house style reference,
  not by stubbing fetch. Assert observable behaviour, not implementation detail.
- Tests must be deterministic: await what is asynchronous, and never assert on
  wall-clock timing.

QUALITY BAR
Write what a senior engineer on this codebase would write: named exports,
explicit prop types, no \`any\`, no dead code, no defensive clutter around things
the type system already guarantees. Handle the loading and error paths the task
asks for and no speculative ones.
`.trim();

function renderTask(task: PlannedTask): string {
  const sections = [
    "## Your task",
    "",
    `**${task.title}** (${task.kind})`,
    "",
    `Files to produce: ${task.targetFiles.join(", ")}`,
    `Symbols to export: ${task.exports.join(", ") || "(none)"}`,
  ];

  // The interface is not a suggestion: consumers of this task were, or will be,
  // handed these exact declarations. Deviating compiles here and breaks there.
  if (task.exportedInterface.trim() !== "") {
    sections.push(
      "",
      "### The interface you must implement, exactly",
      "",
      "Other tasks are given these declarations verbatim and code against them.",
      "Widening, renaming or adding overloads breaks them.",
      "",
      "```ts",
      task.exportedInterface.trim(),
      "```",
    );
  }

  sections.push(
    "",
    "Acceptance criteria — every one of these must hold:",
    ...task.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  );

  return sections.join("\n");
}

export interface GeneratorContext {
  readonly contract: string;
  readonly styleReference: string;
  readonly dependencyContext: string;
  /** The originating requirements, so the task keeps its purpose in view. */
  readonly requirementContext: string;
}

export function buildGeneratorUser(task: PlannedTask, context: GeneratorContext): string {
  return [
    context.contract,
    "",
    context.styleReference,
    "",
    context.dependencyContext,
    "",
    context.requirementContext,
    "",
    "---",
    "",
    renderTask(task),
  ]
    .filter((section) => section.trim() !== "")
    .join("\n");
}

/**
 * The repair prompt: the same role, a different question.
 *
 * Deliberately narrow. It carries the failing file and only the diagnostics
 * attributed to this task, because a repair prompt that also shows unrelated
 * errors invites the model to "fix" files it does not own. Re-stating the
 * original task keeps it from satisfying the compiler at the cost of the
 * requirement — the classic repair failure, where the error disappears along
 * with the feature.
 */
export function buildRepairUser(
  task: PlannedTask,
  context: GeneratorContext,
  currentFiles: readonly { path: string; contents: string }[],
  diagnostics: string,
  attempt: number,
): string {
  return [
    context.contract,
    "",
    context.dependencyContext,
    "",
    "---",
    "",
    renderTask(task),
    "",
    "---",
    "",
    `## This is repair attempt ${attempt}. Your previous output does not compile or its tests fail.`,
    "",
    "What you produced:",
    ...currentFiles.flatMap((file) => [`### ${file.path}`, "```tsx", file.contents.trim(), "```", ""]),
    "Diagnostics for these files only:",
    "```",
    diagnostics.trim(),
    "```",
    "",
    "Return the complete corrected files. Fix the cause rather than silencing the",
    "symptom: do not delete a failing assertion, weaken a type to `any`, or drop a",
    "feature to make an error go away. Every acceptance criterion above must still",
    "hold once it compiles.",
  ]
    .filter((section) => section.trim() !== "")
    .join("\n");
}

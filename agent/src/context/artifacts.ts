import type { GeneratedFile, PlannedTask } from "../schemas.ts";

interface ArtifactRecord {
  readonly taskId: string;
  readonly path: string;
  readonly contents: string;
  readonly exports: readonly string[];
}

/**
 * Total characters of dependency source injected into one generation prompt
 * before falling back to signatures only.
 *
 * A component consuming a hook needs the hook's real return type, not a guess
 * at it — passing the actual source is what stops the generator inventing
 * `{ data }` when the hook returns `{ cars, loading, error }`. Files in this
 * project are 30-80 lines, and a task has one to three dependencies, so the
 * full source is affordable. The cap exists so an unusually fat dependency
 * degrades gracefully instead of blowing the context window.
 */
const DEPENDENCY_SOURCE_BUDGET = 12_000;

/**
 * What has been generated so far, and what it exports.
 *
 * This is the agent's answer to context management. A task never sees the whole
 * project: it sees the invariant contract, plus exactly the depth-one slice of
 * the dependency graph it declared. Prompt size therefore tracks a task's
 * fan-in, not the size of the app, so the last task of a fifty-file build costs
 * no more than the first.
 */
export class ArtifactRegistry {
  private readonly byTask = new Map<string, ArtifactRecord[]>();

  record(taskId: string, files: readonly GeneratedFile[]): void {
    this.byTask.set(
      taskId,
      files.map((file) => ({
        taskId,
        path: file.path,
        contents: file.contents,
        exports: file.exports,
      })),
    );
  }

  /** Every file written so far, for reporting and for the reviewer. */
  paths(): string[] {
    return [...this.byTask.values()].flat().map((record) => record.path).sort();
  }

  has(taskId: string): boolean {
    return this.byTask.has(taskId);
  }

  /**
   * Renders the dependency slice for a task: the planned interface always, the
   * implementation when it fits.
   *
   * The two halves do different jobs. The interface comes from the plan, so it
   * is present regardless of how large the dependencies turned out to be — and
   * it is precisely the integration task, with the most dependencies, that most
   * needs the signatures it consumes. An earlier version degraded to bare symbol
   * names once sources exceeded the budget, which starved exactly the task that
   * could least afford it and produced an App that destructured fields its hook
   * never returned. Source is the bonus; the contract is the floor.
   */
  renderDependencyContext(dependencies: readonly PlannedTask[]): string {
    if (dependencies.length === 0) return "";

    const withSource = dependencies.map((task) => ({
      task,
      records: this.byTask.get(task.id) ?? [],
    }));

    const totalSize = withSource.reduce(
      (sum, entry) => sum + entry.records.reduce((inner, record) => inner + record.contents.length, 0),
      0,
    );
    const includeSource = totalSize <= DEPENDENCY_SOURCE_BUDGET;

    const lines: string[] = [
      "## Interfaces this task consumes",
      "",
      "These are fixed contracts decided during planning. Code against them exactly —",
      "do not guess a different shape, and do not change them.",
      "",
    ];

    for (const { task, records } of withSource) {
      const paths = records.map((record) => record.path).join(", ") || task.targetFiles.join(", ");
      lines.push(`### ${paths}`, "```ts", task.exportedInterface.trim() || "(exports nothing)", "```", "");
    }

    if (includeSource) {
      lines.push("### Their implementations, for reference", "");
      for (const { records } of withSource) {
        for (const record of records) {
          lines.push(`#### ${record.path}`, "```tsx", record.contents.trim(), "```", "");
        }
      }
    } else {
      lines.push(
        `_Implementations omitted: ${totalSize} characters exceeds the prompt budget. ` +
          `The interfaces above are authoritative._`,
        "",
      );
    }

    return lines.join("\n");
  }
}

import { describe, expect, it } from "vitest";
import { ArtifactRegistry } from "../context/artifacts.ts";
import {
  renderProhibitionContext,
  renderRequirementContext,
  stripCodeFence,
  verifyAgainstTask,
} from "./generate.ts";
import type { PlannedTask, SpecRequirement } from "../schemas.ts";

const task: PlannedTask = {
  id: "car-card",
  title: "Create CarCard",
  kind: "component",
  targetFiles: ["src/components/CarCard.tsx"],
  dependsOn: [],
  exports: ["CarCard"],
  exportedInterface: "export interface CarCardProps { car: Car }\nexport function CarCard(props: CarCardProps): JSX.Element",
  satisfies: ["see-inventory"],
  acceptanceCriteria: ["renders make and model"],
};

function file(path: string, contents: string) {
  return { path, contents, exports: [] };
}

describe("stripCodeFence", () => {
  it("leaves plain source untouched", () => {
    expect(stripCodeFence("export const a = 1;\n")).toBe("export const a = 1;\n");
  });

  it("removes a language-tagged fence", () => {
    expect(stripCodeFence("```tsx\nexport const a = 1;\n```")).toBe("export const a = 1;\n");
  });

  it("removes an untagged fence", () => {
    expect(stripCodeFence("```\nexport const a = 1;\n```")).toBe("export const a = 1;\n");
  });

  it("does not strip a fence that appears mid-file", () => {
    const source = "const doc = `\n```\n`;\n";
    expect(stripCodeFence(source)).toBe(source);
  });
});

describe("verifyAgainstTask", () => {
  it("accepts exactly the declared files", () => {
    expect(verifyAgainstTask(task, [file("src/components/CarCard.tsx", "export const CarCard = () => null;")])).toEqual([]);
  });

  it("rejects an undeclared file", () => {
    const problems = verifyAgainstTask(task, [
      file("src/components/CarCard.tsx", "x"),
      file("src/components/Extra.tsx", "y"),
    ]);
    expect(problems.join()).toMatch(/does not declare/);
  });

  it("rejects a missing declared file", () => {
    expect(verifyAgainstTask(task, []).join()).toMatch(/did not produce declared file/);
  });

  it("rejects an empty file", () => {
    expect(verifyAgainstTask(task, [file("src/components/CarCard.tsx", "   ")]).join()).toMatch(
      /is empty/,
    );
  });

  it.each([
    "// TODO: implement the rest",
    "export const CarCard = () => null; // ... rest of the code",
    "// implement this later",
  ])("rejects a placeholder implementation: %s", (contents) => {
    expect(verifyAgainstTask(task, [file("src/components/CarCard.tsx", contents)]).join()).toMatch(
      /placeholder/,
    );
  });

  it("reports every problem at once so one repair round can fix them together", () => {
    const problems = verifyAgainstTask(task, [file("src/components/Wrong.tsx", "")]);
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});

describe("renderRequirementContext", () => {
  const requirements: SpecRequirement[] = [
    { id: "see-inventory", text: "Show every car.", required: true },
    { id: "filter-by-year", text: "Filter by year.", required: false },
    { id: "unrelated", text: "Something else.", required: true },
  ];

  it("includes only the requirements the task cites", () => {
    const rendered = renderRequirementContext(task, requirements);
    expect(rendered).toContain("Show every car.");
    expect(rendered).not.toContain("Something else.");
  });

  it("marks optional requirements as optional", () => {
    const optionalTask = { ...task, satisfies: ["filter-by-year"] };
    expect(renderRequirementContext(optionalTask, requirements)).toContain("(optional in the spec)");
  });

  it("returns nothing for a task citing no requirements", () => {
    expect(renderRequirementContext({ ...task, satisfies: [] }, requirements)).toBe("");
  });
});

describe("ArtifactRegistry", () => {
  const hookTask: PlannedTask = {
    id: "use-cars",
    title: "Create useCars",
    kind: "hook",
    targetFiles: ["src/hooks/useCars.ts"],
    dependsOn: [],
    exports: ["useCars"],
    exportedInterface:
      "export interface UseCarsResult { cars: Car[]; loading: boolean }\nexport function useCars(): UseCarsResult",
    satisfies: ["see-inventory"],
    acceptanceCriteria: ["returns cars"],
  };

  it("returns no dependency section for a leaf task", () => {
    expect(new ArtifactRegistry().renderDependencyContext([])).toBe("");
  });

  it("states the planned interface as the authoritative contract", () => {
    const registry = new ArtifactRegistry();
    registry.record("use-cars", [
      {
        path: "src/hooks/useCars.ts",
        contents: "export function useCars() { return { cars: [], loading: false }; }",
        exports: ["useCars"],
      },
    ]);

    const rendered = registry.renderDependencyContext([hookTask]);
    expect(rendered).toContain("Interfaces this task consumes");
    expect(rendered).toContain("export function useCars(): UseCarsResult");
    expect(rendered).toMatch(/code against them exactly/i);
  });

  it("includes the implementation as reference when it fits the budget", () => {
    const registry = new ArtifactRegistry();
    registry.record("use-cars", [
      {
        path: "src/hooks/useCars.ts",
        contents: "export function useCars() { return { cars: [], loading: false }; }",
        exports: ["useCars"],
      },
    ]);

    expect(registry.renderDependencyContext([hookTask])).toContain("Their implementations");
  });

  /**
   * The regression that motivated planned interfaces: an integration task with
   * several large dependencies used to receive bare symbol names, and generated
   * an App destructuring fields its hook never returned.
   */
  it("keeps the interface when the implementation exceeds the budget", () => {
    const registry = new ArtifactRegistry();
    registry.record("use-cars", [
      { path: "src/hooks/useCars.ts", contents: "x".repeat(20_000), exports: ["useCars"] },
    ]);

    const rendered = registry.renderDependencyContext([hookTask]);
    expect(rendered).toContain("export function useCars(): UseCarsResult");
    expect(rendered).toContain("Implementations omitted");
    expect(rendered).not.toContain("xxxxxxxxxx");
  });

  it("still states the interface for a dependency that has not been generated", () => {
    // Ordering guarantees this cannot happen in a real run, but the contract is
    // known from the plan regardless of execution state.
    const rendered = new ArtifactRegistry().renderDependencyContext([hookTask]);
    expect(rendered).toContain("export function useCars(): UseCarsResult");
  });

  it("tracks every written path for reporting", () => {
    const registry = new ArtifactRegistry();
    registry.record("a", [{ path: "src/b.ts", contents: "b", exports: [] }]);
    registry.record("b", [{ path: "src/a.ts", contents: "a", exports: [] }]);
    expect(registry.paths()).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("renderProhibitionContext", () => {
  /**
   * Not scoped to the task the way requirements are, and for a reason found by
   * running it: a spec forbidding images produced an image inside a detail panel
   * whose own task said nothing about images. Whichever file reaches for the
   * forbidden thing is not knowable in advance, so every task is told.
   */
  it("lists what the spec forbids", () => {
    const rendered = renderProhibitionContext([
      { id: "no-images", text: "Do not render images of any kind." },
      { id: "no-editing", text: "Do not provide a way to add or edit records." },
    ]);

    expect(rendered).toContain("Do not render images of any kind.");
    expect(rendered).toContain("Do not provide a way to add or edit records.");
    expect(rendered).toMatch(/absence is correct/i);
  });

  it("anticipates the excuse a model reaches for", () => {
    // The breach that happened was a conventional, useful-looking addition.
    expect(renderProhibitionContext([{ id: "x", text: "No images." }])).toMatch(
      /because they seem\s+useful, conventional/,
    );
  });

  it("renders nothing when the spec forbids nothing", () => {
    expect(renderProhibitionContext([])).toBe("");
  });
});

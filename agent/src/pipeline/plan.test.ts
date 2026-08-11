import { describe, expect, it } from "vitest";
import { PlanValidationError, renderPlan, validateAndOrder } from "./plan.ts";
import type { PlannedTask, TaskPlan } from "../schemas.ts";

function task(overrides: Partial<PlannedTask> & { id: string }): PlannedTask {
  return {
    title: `Do ${overrides.id}`,
    kind: "component",
    targetFiles: [`src/components/${overrides.id}.tsx`],
    dependsOn: [],
    exports: [overrides.id],
    satisfies: ["req-a"],
    acceptanceCriteria: ["renders"],
    ...overrides,
  };
}

function plan(tasks: PlannedTask[], requirements = [{ id: "req-a", text: "A", required: true }]): TaskPlan {
  return { summary: "test plan", requirements, tasks };
}

describe("validateAndOrder — dependency levels", () => {
  it("puts independent tasks in one level", () => {
    const ordered = validateAndOrder(plan([task({ id: "a" }), task({ id: "b" })]));
    expect(ordered.levels).toHaveLength(1);
    expect(ordered.levels[0]).toHaveLength(2);
  });

  it("layers a dependency chain", () => {
    const ordered = validateAndOrder(
      plan([
        task({ id: "c", dependsOn: ["b"] }),
        task({ id: "a" }),
        task({ id: "b", dependsOn: ["a"] }),
      ]),
    );

    expect(ordered.levels.map((level) => level.map((entry) => entry.id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
  });

  it("groups a diamond so the two middle tasks share a level", () => {
    const ordered = validateAndOrder(
      plan([
        task({ id: "root" }),
        task({ id: "left", dependsOn: ["root"] }),
        task({ id: "right", dependsOn: ["root"] }),
        task({ id: "join", dependsOn: ["left", "right"] }),
      ]),
    );

    expect(ordered.levels.map((level) => level.map((entry) => entry.id))).toEqual([
      ["root"],
      ["left", "right"],
      ["join"],
    ]);
  });
});

describe("validateAndOrder — rejections", () => {
  it("rejects a cycle and names the tasks involved", () => {
    const attempt = () =>
      validateAndOrder(
        plan([task({ id: "a", dependsOn: ["b"] }), task({ id: "b", dependsOn: ["a"] })]),
      );

    expect(attempt).toThrow(PlanValidationError);
    expect(attempt).toThrow(/cycle/i);
  });

  it("rejects a self-dependency", () => {
    expect(() => validateAndOrder(plan([task({ id: "a", dependsOn: ["a"] })]))).toThrow(
      /depends on itself/,
    );
  });

  it("rejects a dangling dependency", () => {
    expect(() => validateAndOrder(plan([task({ id: "a", dependsOn: ["ghost"] })]))).toThrow(
      /unknown task "ghost"/,
    );
  });

  it("rejects duplicate task ids", () => {
    expect(() =>
      validateAndOrder(
        plan([task({ id: "a" }), task({ id: "a", targetFiles: ["src/components/other.tsx"] })]),
      ),
    ).toThrow(/duplicate task ids/);
  });

  it("rejects two tasks claiming the same file", () => {
    expect(() =>
      validateAndOrder(
        plan([
          task({ id: "a", targetFiles: ["src/App.tsx"] }),
          task({ id: "b", targetFiles: ["src/App.tsx"] }),
        ]),
      ),
    ).toThrow(/claimed by 2 tasks/);
  });

  it("rejects a task targeting provided infrastructure", () => {
    expect(() =>
      validateAndOrder(plan([task({ id: "a", targetFiles: ["src/mocks/handlers.ts"] })])),
    ).toThrow(/boilerplate/);
  });

  it("rejects a task targeting a config file outside src/", () => {
    expect(() =>
      validateAndOrder(plan([task({ id: "a", targetFiles: ["package.json"] })])),
    ).toThrow(/restricted to src\//);
  });

  it("collects every problem rather than stopping at the first", () => {
    try {
      validateAndOrder(
        plan([
          task({ id: "a", dependsOn: ["ghost"], targetFiles: ["src/types.ts"] }),
          task({ id: "b", dependsOn: ["b"] }),
        ]),
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanValidationError);
      expect((error as PlanValidationError).issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("validateAndOrder — warnings", () => {
  it("warns when a required requirement has no task", () => {
    const ordered = validateAndOrder(
      plan(
        [task({ id: "a", satisfies: ["req-a"] })],
        [
          { id: "req-a", text: "A", required: true },
          { id: "req-b", text: "B", required: true },
        ],
      ),
    );

    expect(ordered.warnings.join()).toMatch(/no task satisfies required requirement "req-b"/);
  });

  it("does not warn about an unclaimed optional requirement", () => {
    const ordered = validateAndOrder(
      plan(
        [task({ id: "a", satisfies: ["req-a"] })],
        [
          { id: "req-a", text: "A", required: true },
          { id: "req-b", text: "B", required: false },
        ],
      ),
    );

    expect(ordered.warnings.join()).not.toMatch(/req-b/);
  });

  it("warns when a task cites a requirement that does not exist", () => {
    const ordered = validateAndOrder(plan([task({ id: "a", satisfies: ["req-a", "invented"] })]));
    expect(ordered.warnings.join()).toMatch(/unknown requirement "invented"/);
  });

  it("treats traceability gaps as warnings, not failures", () => {
    expect(() => validateAndOrder(plan([task({ id: "a", satisfies: [] })]))).not.toThrow();
  });
});

describe("renderPlan", () => {
  it("shows levels, parallelism and requirement traceability", () => {
    const ordered = validateAndOrder(
      plan([
        task({ id: "root" }),
        task({ id: "left", dependsOn: ["root"] }),
        task({ id: "right", dependsOn: ["root"] }),
      ]),
    );

    const rendered = renderPlan(ordered);
    expect(rendered).toContain("3 across 2 dependency level(s)");
    expect(rendered).toContain("2 in parallel");
    expect(rendered).toContain("satisfies: req-a");
  });
});

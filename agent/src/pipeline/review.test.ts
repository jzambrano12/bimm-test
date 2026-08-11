import { describe, expect, it } from "vitest";
import { formatFindingsForRepair, routeFindings } from "./review.ts";
import { validateAndOrder } from "./plan.ts";
import type { PlannedTask, ReviewFinding, TaskPlan } from "../schemas.ts";

function task(id: string, targetFiles: string[], kind: PlannedTask["kind"] = "component"): PlannedTask {
  return {
    id,
    title: `Build ${id}`,
    kind,
    targetFiles,
    dependsOn: [],
    exports: [id],
    exportedInterface: `export function ${id}()`,
    satisfies: ["responsive"],
    acceptanceCriteria: ["works"],
  };
}

const plan: TaskPlan = {
  summary: "test",
  requirements: [
    { id: "responsive", text: "Use 640px and 1024px thresholds.", required: true },
    { id: "bonus-filter", text: "Filter by year.", required: false },
  ],
  tasks: [task("car-image", ["src/components/CarImage.tsx"])],
};

const ordered = validateAndOrder(plan);

function finding(overrides: Partial<ReviewFinding>): ReviewFinding {
  return {
    requirementId: "responsive",
    status: "partial",
    evidence: "Uses 600px and 900px; the requirement states 640px and 1024px.",
    remediationTitle: "Use the specified thresholds",
    remediationFiles: ["src/components/CarImage.tsx"],
    ...overrides,
  };
}

describe("routeFindings", () => {
  it("routes an unsatisfied required finding to the task that owns the file", () => {
    const { actionable, unroutable } = routeFindings([finding({})], ordered);
    expect(actionable).toHaveLength(1);
    expect(actionable[0]?.task.id).toBe("car-image");
    expect(unroutable).toEqual([]);
  });

  it("ignores satisfied findings", () => {
    const { actionable, unroutable } = routeFindings(
      [finding({ status: "satisfied", remediationFiles: [] })],
      ordered,
    );
    expect(actionable).toEqual([]);
    expect(unroutable).toEqual([]);
  });

  it("reports but does not repair an unmet optional requirement", () => {
    // Skipping an optional requirement is a choice the spec permits; spending a
    // repair call on it would be the agent overruling the specification.
    const { actionable, unroutable } = routeFindings(
      [finding({ requirementId: "bonus-filter", status: "missing" })],
      ordered,
    );
    expect(actionable).toEqual([]);
    expect(unroutable[0]?.reason).toMatch(/optional/);
  });

  it("refuses a finding that would change provided infrastructure", () => {
    // The reviewer is allowed to be wrong about where a fix belongs, but it must
    // not be able to launder that mistake into a write.
    const { actionable, unroutable } = routeFindings(
      [finding({ remediationFiles: ["src/mocks/handlers.ts"] })],
      ordered,
    );
    expect(actionable).toEqual([]);
    expect(unroutable[0]?.reason).toMatch(/provided infrastructure/);
  });

  it("refuses a finding naming a file no task owns", () => {
    const { actionable, unroutable } = routeFindings(
      [finding({ remediationFiles: ["src/components/Imagined.tsx"] })],
      ordered,
    );
    expect(actionable).toEqual([]);
    expect(unroutable[0]?.reason).toMatch(/no task owns/);
  });

  it("reports a finding with no remediation file rather than guessing one", () => {
    const { unroutable } = routeFindings([finding({ remediationFiles: [] })], ordered);
    expect(unroutable[0]?.reason).toMatch(/named no file/);
  });

  it("groups two findings on one file so they are fixed together", () => {
    const { actionable } = routeFindings(
      [finding({}), finding({ requirementId: "responsive", status: "missing" })],
      ordered,
    );
    expect(actionable).toHaveLength(2);
    expect(new Set(actionable.map((entry) => entry.task.id))).toEqual(new Set(["car-image"]));
  });
});

describe("formatFindingsForRepair", () => {
  it("carries the reviewer's side-by-side comparison into the repair prompt", () => {
    const { actionable } = routeFindings([finding({})], ordered);
    const rendered = formatFindingsForRepair(actionable, () => "Use 640px and 1024px thresholds.");

    // The evidence is the useful part: it already states what was asked versus
    // what was written, which is exactly what a fix needs.
    expect(rendered).toContain("Uses 600px and 900px");
    expect(rendered).toContain("Use 640px and 1024px thresholds.");
    expect(rendered).toContain("Use the specified thresholds");
  });
});

import { describe, expect, it } from "vitest";
import { auditFindings, formatFindingsForRepair, routeFindings } from "./review.ts";
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

  it("reports a finding that names no file and that no task claims", () => {
    // Distinct from the plan-fallback case below: here nothing in the plan
    // claims the requirement either, so there is genuinely nowhere to send it.
    const { actionable, unroutable } = routeFindings(
      [finding({ requirementId: "orphan", remediationFiles: [] })],
      validateAndOrder({
        ...plan,
        requirements: [
          ...plan.requirements,
          { id: "orphan", text: "Something nobody built.", required: true },
        ],
      }),
    );

    expect(actionable).toEqual([]);
    expect(unroutable[0]?.reason).toMatch(/no task claims this requirement/);
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

describe("auditFindings", () => {
  const sourceWithDefaults = () => 'useMediaQuery(theme.breakpoints.up("md"))';
  const sourceWithSpecValues = () =>
    'useMediaQuery("(max-width: 640px)"); useMediaQuery("(min-width: 641px) and (max-width: 1023px)")';

  const requirements = [
    {
      id: "responsive",
      text: "Serve mobile up to 640px, tablet 641px to 1023px, desktop 1024px or wider.",
      required: true,
    },
    { id: "search", text: "Filter the list by model as the user types.", required: true },
  ];

  /**
   * The exact verdict a real run produced: "satisfied" on a component using its
   * UI library's 600px/900px defaults, with evidence that named no number.
   */
  it("downgrades a satisfied verdict when the source uses none of the stated values", () => {
    // The original defect: a component on its library's 600/900 defaults, blessed
    // by a reviewer whose evidence named no number at all.
    const { findings, downgraded } = auditFindings(
      [
        finding({
          requirementId: "responsive",
          status: "satisfied",
          evidence: "CarCard.tsx switches images with useMediaQuery on theme breakpoints.",
          remediationTitle: "",
          remediationFiles: [],
        }),
      ],
      requirements,
      sourceWithDefaults,
    );

    expect(findings[0]?.status).toBe("partial");
    expect(downgraded).toEqual(["responsive"]);
    expect(findings[0]?.evidence).toMatch(/Downgraded automatically/);
    expect(findings[0]?.remediationTitle).toMatch(/640/);
  });

  it("accepts a correct implementation that leaves one boundary implicit", () => {
    // The false positive that reading prose produced: evidence citing three of
    // four thresholds was rejected, although handling <=640 and 641-1023 covers
    // >=1024 in the else branch.
    const { findings, downgraded } = auditFindings(
      [
        finding({
          requirementId: "responsive",
          status: "satisfied",
          evidence: "CarCard.tsx selects the image by viewport.",
        }),
      ],
      requirements,
      sourceWithSpecValues,
    );

    expect(findings[0]?.status).toBe("satisfied");
    expect(downgraded).toEqual([]);
  });

  it("does not contradict the reviewer when there is no source to inspect", () => {
    const { findings } = auditFindings(
      [finding({ requirementId: "responsive", status: "satisfied", evidence: "Done." })],
      requirements,
      () => "",
    );
    expect(findings[0]?.status).toBe("satisfied");
  });

  it("does not audit requirements that state no values", () => {
    // Nothing to compare, so demanding a citation would only manufacture noise.
    const { findings, downgraded } = auditFindings(
      [finding({ requirementId: "search", status: "satisfied", evidence: "Handled in useCars." })],
      requirements,
      sourceWithDefaults,
    );

    expect(findings[0]?.status).toBe("satisfied");
    expect(downgraded).toEqual([]);
  });

  it("leaves already-unsatisfied findings untouched", () => {
    const { findings } = auditFindings(
      [finding({ requirementId: "responsive", status: "missing", evidence: "Not implemented." })],
      requirements,
      sourceWithDefaults,
    );
    expect(findings[0]?.status).toBe("missing");
  });
});

describe("routeFindings — fallback via the plan", () => {
  it("routes a finding with no named file to the task that claims the requirement", () => {
    // Audited downgrades carry no remediation file, but the plan already records
    // which task serves which requirement.
    const { actionable } = routeFindings(
      [finding({ remediationFiles: [] })],
      ordered,
    );
    expect(actionable[0]?.task.id).toBe("car-image");
  });

  it("does not route a requirement fix to a test task", () => {
    // Changing the test to match wrong behaviour is the failure mode this avoids.
    const planWithTest = validateAndOrder({
      ...plan,
      tasks: [
        task("car-image", ["src/components/CarImage.tsx"]),
        { ...task("image-test", ["src/__tests__/CarImage.test.tsx"], "test"), dependsOn: ["car-image"] },
      ],
    });

    const { actionable } = routeFindings([finding({ remediationFiles: [] })], planWithTest);
    expect(actionable.map((entry) => entry.task.id)).toEqual(["car-image"]);
  });
});

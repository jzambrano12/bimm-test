import { describe, expect, it } from "vitest";
import {
  diagnoseHarnessFailure,
  diagnosticsForFiles,
  formatDiagnostics,
  parseFailedTestFiles,
  parseTypecheckOutput,
} from "./validate.ts";

/** Verbatim tsc output from the agent's first real run. */
const REAL_TSC_OUTPUT = `
> car-inventory-boilerplate@1.0.0 typecheck
> tsc --noEmit

src/__tests__/AddCarForm.test.tsx(41,24): error TS2322: Type '{ onSubmit: Mock<Procedure>; onClose: Mock<Procedure>; }' is not assignable to type 'IntrinsicAttributes & AddCarFormProps'.
  Property 'onSubmit' does not exist on type 'IntrinsicAttributes & AddCarFormProps'.
src/__tests__/CarFilterSort.test.tsx(73,46): error TS2551: Property 'inTheDocument' does not exist on type 'Assertion<HTMLElement | null>'. Did you mean 'toBeInTheDocument'?
src/App.tsx(24,5): error TS2339: Property 'filteredCars' does not exist on type 'Car[]'.
src/App.tsx(25,5): error TS2339: Property 'filterText' does not exist on type 'Car[]'.
`.trim();

describe("parseTypecheckOutput", () => {
  const diagnostics = parseTypecheckOutput(REAL_TSC_OUTPUT);

  it("finds every diagnostic and ignores npm's banner", () => {
    expect(diagnostics).toHaveLength(4);
  });

  it("captures file, position and code", () => {
    expect(diagnostics[0]).toMatchObject({
      file: "src/__tests__/AddCarForm.test.tsx",
      line: 41,
      column: 24,
      code: "TS2322",
    });
  });

  it("folds indented continuation lines into the diagnostic they explain", () => {
    // The continuation is where the actual mismatch is named, so losing it
    // would strip a repair prompt of the only useful detail.
    expect(diagnostics[0]?.message).toContain("Property 'onSubmit' does not exist");
  });

  it("keeps diagnostics separate when several share a file", () => {
    const appErrors = diagnostics.filter((diagnostic) => diagnostic.file === "src/App.tsx");
    expect(appErrors.map((diagnostic) => diagnostic.line)).toEqual([24, 25]);
  });

  it("returns nothing for clean output", () => {
    expect(parseTypecheckOutput("> tsc --noEmit\n")).toEqual([]);
  });

  it("normalises Windows path separators", () => {
    const parsed = parseTypecheckOutput("src\\App.tsx(1,1): error TS1005: ';' expected.");
    expect(parsed[0]?.file).toBe("src/App.tsx");
  });

  it("does not mistake a warning for an error", () => {
    expect(parseTypecheckOutput("src/App.tsx(1,1): warning TS6133: unused.")).toEqual([]);
  });
});

describe("diagnosticsForFiles", () => {
  const diagnostics = parseTypecheckOutput(REAL_TSC_OUTPUT);

  it("returns only diagnostics for the requested files", () => {
    const scoped = diagnosticsForFiles(diagnostics, ["src/App.tsx"]);
    expect(scoped).toHaveLength(2);
    expect(scoped.every((diagnostic) => diagnostic.file === "src/App.tsx")).toBe(true);
  });

  it("returns nothing when a file has no diagnostics", () => {
    expect(diagnosticsForFiles(diagnostics, ["src/hooks/useCars.ts"])).toEqual([]);
  });

  it("scopes repair to the owning task, excluding other tasks' errors", () => {
    // The reason attribution exists: a task must never be shown, and so never
    // be tempted to edit, a file it does not own.
    const scoped = diagnosticsForFiles(diagnostics, ["src/__tests__/AddCarForm.test.tsx"]);
    expect(formatDiagnostics(scoped)).not.toContain("App.tsx");
  });
});

describe("formatDiagnostics", () => {
  it("renders file:line:column code: message", () => {
    const formatted = formatDiagnostics(parseTypecheckOutput(REAL_TSC_OUTPUT));
    expect(formatted).toContain("src/App.tsx:24:5 TS2339:");
  });

  it("renders nothing for an empty list", () => {
    expect(formatDiagnostics([])).toBe("");
  });
});

describe("parseFailedTestFiles", () => {
  it("extracts failing test files from vitest output", () => {
    const output = `
 ✓ src/__tests__/CarCard.test.tsx (3 tests)
 FAIL  src/__tests__/AddCarForm.test.tsx > AddCarForm > submits
AssertionError: expected 1 to be 0
 ❯ src/__tests__/CarGrid.test.tsx:14:7
`;
    expect(parseFailedTestFiles(output)).toEqual([
      "src/__tests__/AddCarForm.test.tsx",
      "src/__tests__/CarGrid.test.tsx",
    ]);
  });

  it("deduplicates a file that fails several assertions", () => {
    const output = "FAIL  src/__tests__/A.test.tsx > one\nFAIL  src/__tests__/A.test.tsx > two";
    expect(parseFailedTestFiles(output)).toEqual(["src/__tests__/A.test.tsx"]);
  });

  it("returns nothing when the suite passes", () => {
    expect(parseFailedTestFiles(" Test Files  4 passed (4)\n Tests  12 passed (12)")).toEqual([]);
  });
});

describe("diagnoseHarnessFailure", () => {
  it.each([
    ["Error: Cannot find module '/x/src/test-setup.ts'", /module could not be resolved/],
    ["Failed to load url /x/src/test-setup.ts", /could not load a file/],
    ["Failed to resolve import \"@/hooks/useCars\"", /import could not be resolved/],
    [" Test Files  2 failed (2)\n      Tests  no tests", /no tests executed/],
  ])("recognises %s as a harness fault", (output, expected) => {
    expect(diagnoseHarnessFailure(output)).toMatch(expected);
  });

  it("treats an ordinary assertion failure as repairable code", () => {
    const output = `
 FAIL  src/__tests__/App.test.tsx > renders
AssertionError: expected 2 to be 1
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
`;
    expect(diagnoseHarnessFailure(output)).toBeUndefined();
  });

  it("treats a multiple-elements-found error as repairable code", () => {
    // A real failure from a generated test: getByLabelText(/make/i) matched two
    // fields. That is the test's problem to fix, not the harness's.
    expect(
      diagnoseHarnessFailure("TestingLibraryElementError: Found multiple elements"),
    ).toBeUndefined();
  });
});

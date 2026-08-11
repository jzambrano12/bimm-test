import { describe, expect, it } from "vitest";
import { boilerplateRoot } from "../tools/scaffold.ts";
import { buildContractDigest, renderContract, renderStyleReference } from "./repoMap.ts";

/**
 * Built once against the real provided boilerplate, not a fixture. That is the
 * point: the digest's job is to describe *this* project, so a fixture would
 * only prove the parser works on data we invented.
 */
const digest = await buildContractDigest(boilerplateRoot());

describe("buildContractDigest against the provided boilerplate", () => {
  it("captures the Car type verbatim", () => {
    expect(digest.carType).toContain("interface Car");
    for (const field of ["make", "model", "year", "color", "mobile", "tablet", "desktop"]) {
      expect(digest.carType).toContain(field);
    }
  });

  it("captures the GraphQL documents verbatim", () => {
    expect(digest.graphqlOperations).toContain("GET_CARS");
    expect(digest.graphqlOperations).toContain("GET_CAR");
    expect(digest.graphqlOperations).toContain("ADD_CAR");
  });

  it("discovers exactly the operations MSW serves", () => {
    expect(digest.mockedOperations).toEqual([
      "AddCar (mutation)",
      "GetCar (query)",
      "GetCars (query)",
    ]);
  });

  it("detects the strictness flags that break naive generated code", () => {
    const rules = digest.compilerRules.join("\n");
    expect(rules).toMatch(/noUncheckedIndexedAccess|possibly undefined/i);
    expect(rules).toMatch(/unused/i);
    expect(rules).toMatch(/JSX runtime is automatic/);
  });

  it("does not claim flags the boilerplate has not enabled", () => {
    // The app tsconfig has no exactOptionalPropertyTypes; asserting it absent
    // proves the rules are derived rather than transcribed.
    expect(digest.compilerRules.join("\n")).not.toMatch(/optional property cannot be/);
  });

  it("warns against the JSX namespace that React 19 removed", () => {
    // A few-shot example using `JSX.Element` propagated this error into every
    // generated component. The rule is derived from jsx: react-jsx, so it
    // travels with the contract rather than living in one prompt.
    expect(digest.compilerRules.join("\n")).toMatch(/no global `JSX` namespace/i);
  });

  it("reports the path alias", () => {
    expect(digest.pathAlias).toContain("@/*");
  });

  it("lists real dependencies with versions", () => {
    expect(digest.dependencies.some((dep) => dep.startsWith("@apollo/client@"))).toBe(true);
    expect(digest.dependencies.some((dep) => dep.startsWith("@mui/material@"))).toBe(true);
    expect(digest.dependencies.some((dep) => dep.startsWith("msw@"))).toBe(true);
  });

  it("names the protected paths", () => {
    expect(digest.protectedPaths).toContain("src/types.ts");
    expect(digest.protectedPaths).toContain("src/mocks/");
  });
});

describe("rendered prompt blocks", () => {
  it("renders a contract that mentions no specification detail", () => {
    const contract = renderContract(digest);
    // The contract is the invariant half of the prompt. If a spec word leaks in
    // here, the agent has started memorising the assignment.
    for (const specWord of ["search bar", "sort by year", "Add Car form", "responsive image"]) {
      expect(contract.toLowerCase()).not.toContain(specWord.toLowerCase());
    }
  });

  it("keeps the contract compact enough to inject into every prompt", () => {
    // ~4 chars per token: a few thousand characters, not a repo dump.
    expect(renderContract(digest).length).toBeLessThan(8_000);
  });

  it("renders the boilerplate's own component as the style reference", () => {
    const style = renderStyleReference(digest);
    expect(style).toContain("Example.tsx");
    expect(style).toContain("Example.test.tsx");
    expect(style).toContain("MockedProvider");
  });

  it("warns the generator not to import from the reference files", () => {
    expect(renderStyleReference(digest)).toMatch(/do not import from them/i);
  });
});

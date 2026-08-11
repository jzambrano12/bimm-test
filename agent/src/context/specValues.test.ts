import { describe, expect, it } from "vitest";
import { citesAnyValue, extractStatedValues } from "./specValues.ts";

describe("extractStatedValues", () => {
  /**
   * The regression this module was extracted for: `\b\d{2,}\b` matches none of
   * these, because the trailing boundary cannot fall between a digit and "px".
   */
  it("extracts values with a unit suffix", () => {
    expect(extractStatedValues("mobile up to 640px, tablet 641px to 1023px, desktop 1024px")).toEqual(
      ["640", "641", "1023", "1024"],
    );
  });

  it("extracts bare numbers", () => {
    expect(extractStatedValues("at most 20 per page")).toEqual(["20"]);
  });

  it("ignores single digits as incidental prose", () => {
    expect(extractStatedValues("there are 5 seed records and 3 tests")).toEqual([]);
  });

  it("deduplicates repeated values", () => {
    expect(extractStatedValues("640px and again 640px")).toEqual(["640"]);
  });

  it("does not split a number at its start", () => {
    expect(extractStatedValues("v1024")).toEqual([]);
  });

  it("returns nothing for text with no values", () => {
    expect(extractStatedValues("pick a sensible image")).toEqual([]);
  });
});

describe("citesAnyValue", () => {
  it("is true when a value appears", () => {
    expect(citesAnyValue('useMediaQuery("(max-width: 640px)")', ["640", "1024"])).toBe(true);
  });

  /**
   * Applied to source, not prose. A faithful implementation of "mobile up to
   * 640px, tablet 641-1023px, desktop 1024px and above" writes three of those
   * numbers and leaves the fourth to an else branch, so requiring all of them
   * would fail correct code.
   */
  it("is true for an implementation that leaves one boundary implicit", () => {
    const source = 'const a = "(max-width: 640px)"; const b = "(min-width: 641px) and (max-width: 1023px)";';
    expect(citesAnyValue(source, ["640", "641", "1023", "1024"])).toBe(true);
  });

  it("is false for an implementation that used a library's own defaults", () => {
    const source = 'useMediaQuery(theme.breakpoints.up("md"))';
    expect(citesAnyValue(source, ["640", "641", "1023", "1024"])).toBe(false);
  });

  it("is false for an empty value list, so it never vouches vacuously", () => {
    expect(citesAnyValue("anything", [])).toBe(false);
  });
});

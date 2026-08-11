import { describe, expect, it } from "vitest";
import { citesAllValues, extractStatedValues } from "./specValues.ts";

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

describe("citesAllValues", () => {
  it("is true when every value appears", () => {
    expect(citesAllValues("(max-width: 640px) and (min-width: 1024px)", ["640", "1024"])).toBe(true);
  });

  /**
   * The case that motivated requiring all: a reviewer vouched for four
   * thresholds by citing one, and that one had appeared incidentally in a
   * placeholder image URL of 640x360.
   */
  it("is false when only some values appear", () => {
    expect(citesAllValues("image is 640x360", ["640", "641", "1023", "1024"])).toBe(false);
  });

  it("is false when none appear", () => {
    expect(citesAllValues("uses theme breakpoints", ["640", "1024"])).toBe(false);
  });

  it("is false for an empty value list, so it never vouches vacuously", () => {
    expect(citesAllValues("anything", [])).toBe(false);
  });
});

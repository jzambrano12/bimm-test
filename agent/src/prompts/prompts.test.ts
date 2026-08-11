import { describe, expect, it } from "vitest";
import { PLANNER_SYSTEM } from "./planner.ts";
import { GENERATOR_SYSTEM } from "./generator.ts";

/**
 * Prompts are load-bearing artefacts, so the properties they must hold are
 * asserted rather than trusted to review.
 */
describe("prompt hygiene", () => {
  const prompts = [
    ["planner", PLANNER_SYSTEM],
    ["generator", GENERATOR_SYSTEM],
  ] as const;

  for (const [name, prompt] of prompts) {
    /**
     * The anti-memorisation guarantee. The evaluators intend to run a modified
     * spec; a prompt that names the assignment's domain would produce this
     * assignment's answer regardless of what the spec asked for.
     */
    it(`${name} prompt contains no vocabulary from the target domain`, () => {
      // Only terms that can mean nothing else here. "model" is the LLM, and
      // "make" is an ordinary English verb — including them would fail on
      // legitimate prose and teach the next person to delete the test rather
      // than trust it.
      const forbidden = [
        "car",
        "cars",
        "vehicle",
        "dealership",
        "inventory",
        "search bar",
        "sort by year",
        "colour",
      ];

      for (const term of forbidden) {
        expect(prompt.toLowerCase(), `"${term}" leaked into the ${name} prompt`).not.toMatch(
          new RegExp(`\\b${term}\\b`),
        );
      }
    });

    /**
     * `JSX.Element` in the planner's few-shot example was copied into every
     * component interface and failed the typecheck under React 19's automatic
     * runtime. Cheap to assert, expensive to rediscover.
     */
    it(`${name} prompt does not reference the removed global JSX namespace`, () => {
      expect(prompt).not.toContain("JSX.Element");
    });
  }

  it("planner example uses an unrelated domain, proving shape is taught not answers", () => {
    expect(PLANNER_SYSTEM).toContain("Book");
  });
});

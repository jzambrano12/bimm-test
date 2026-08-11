import { describe, expect, it } from "vitest";
import { zodResponseFormat } from "openai/helpers/zod";
import { stripFences } from "./structured.ts";
import { GenerationResult, ReviewVerdict, TaskPlan } from "../schemas.ts";

describe("stripFences", () => {
  it("leaves bare JSON untouched", () => {
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });

  it("unwraps a ```json fence", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("unwraps an unlabelled fence", () => {
    expect(stripFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("does not mangle JSON containing backticks in a string value", () => {
    const source = '{"contents":"const a = `x`;"}';
    expect(JSON.parse(stripFences(source))).toEqual({ contents: "const a = `x`;" });
  });
});

/**
 * Guards the seam between Zod and the provider: if a schema uses a construct
 * the OpenAI helper cannot express as strict JSON Schema, it throws here at
 * test time instead of mid-run against a live quota.
 */
describe("schemas are convertible to strict JSON Schema", () => {
  const cases = [
    ["TaskPlan", TaskPlan],
    ["GenerationResult", GenerationResult],
    ["ReviewVerdict", ReviewVerdict],
  ] as const;

  for (const [name, schema] of cases) {
    it(`converts ${name}`, () => {
      const format = zodResponseFormat(schema, name);
      expect(format.type).toBe("json_schema");
      expect(format.json_schema.strict).toBe(true);
      expect(format.json_schema.schema).toBeTypeOf("object");
    });
  }
});

describe("TaskPlan validation", () => {
  const validPlan = {
    summary: "Build a car inventory UI.",
    requirements: [{ id: "list-cars", text: "Show all cars.", required: true }],
    tasks: [
      {
        id: "use-cars-hook",
        title: "Create useCars hook",
        kind: "hook",
        targetFiles: ["src/hooks/useCars.ts"],
        dependsOn: [],
        exports: ["useCars"],
        exportedInterface: "export function useCars(): { cars: Car[]; loading: boolean }",
        satisfies: ["list-cars"],
        acceptanceCriteria: ["Returns cars, loading and error"],
      },
    ],
  };

  it("accepts a well-formed plan", () => {
    expect(TaskPlan.safeParse(validPlan).success).toBe(true);
  });

  it("rejects an unknown task kind", () => {
    const plan = structuredClone(validPlan);
    plan.tasks[0]!.kind = "database";
    expect(TaskPlan.safeParse(plan).success).toBe(false);
  });

  it("rejects a task with no target files", () => {
    const plan = structuredClone(validPlan);
    plan.tasks[0]!.targetFiles = [];
    expect(TaskPlan.safeParse(plan).success).toBe(false);
  });

  it("rejects a plan with no tasks", () => {
    const plan = { ...validPlan, tasks: [] };
    expect(TaskPlan.safeParse(plan).success).toBe(false);
  });
});

import { z } from "zod";

/**
 * Every LLM boundary in this agent is a Zod schema, and every schema lives
 * here so the contracts are readable in one place.
 *
 * Note the absence of `.optional()`: strict JSON Schema mode requires all
 * properties to be present, so "no value" is modelled as an empty string or
 * empty array. Slightly less elegant in TypeScript, far more reliable across
 * providers than hoping optional fields round-trip.
 */

// ─── Planning ────────────────────────────────────────────────────────────────

export const TaskKind = z.enum(["hook", "component", "test", "integration"]);
export type TaskKind = z.infer<typeof TaskKind>;

/**
 * A requirement extracted from the spec, not invented by the agent.
 *
 * Extracting these explicitly — rather than jumping straight to a file list —
 * is what makes the run auditable: tasks cite requirement ids, and the reviewer
 * later judges the built app against this same list. It is also the seam that
 * keeps the agent spec-driven instead of memorised: change the spec and this
 * list changes, so the task graph changes with it.
 */
export const SpecRequirement = z.object({
  id: z.string().describe("Stable slug, e.g. 'search-by-model'"),
  text: z.string().describe("The requirement restated in one sentence"),
  required: z.boolean().describe("true if mandatory, false if optional/bonus in the spec"),
});
export type SpecRequirement = z.infer<typeof SpecRequirement>;

export const PlannedTask = z.object({
  id: z.string().describe("Stable kebab-case slug, unique within the plan"),
  title: z.string().describe("Imperative one-liner, e.g. 'Create useCars hook'"),
  kind: TaskKind,
  targetFiles: z
    .array(z.string())
    .min(1)
    .describe("Repo-relative paths this task creates or rewrites, e.g. 'src/hooks/useCars.ts'"),
  dependsOn: z.array(z.string()).describe("Task ids that must complete first; [] if none"),
  exports: z
    .array(z.string())
    .describe("Symbols this task will export, so dependent tasks can import them"),
  satisfies: z.array(z.string()).describe("SpecRequirement ids this task contributes to"),
  acceptanceCriteria: z
    .array(z.string())
    .min(1)
    .describe("Observable conditions that make this task done"),
});
export type PlannedTask = z.infer<typeof PlannedTask>;

export const TaskPlan = z.object({
  summary: z.string().describe("Two sentences: what is being built and the overall approach"),
  requirements: z.array(SpecRequirement).min(1),
  tasks: z.array(PlannedTask).min(1),
});
export type TaskPlan = z.infer<typeof TaskPlan>;

// ─── Generation ──────────────────────────────────────────────────────────────

export const GeneratedFile = z.object({
  path: z.string().describe("Repo-relative path, must match one of the task's targetFiles"),
  contents: z.string().describe("Complete file source. No markdown fences, no prose, no ellipses"),
  exports: z.array(z.string()).describe("Symbols this file exports"),
});
export type GeneratedFile = z.infer<typeof GeneratedFile>;

export const GenerationResult = z.object({
  files: z.array(GeneratedFile).min(1),
});
export type GenerationResult = z.infer<typeof GenerationResult>;

// ─── Review ──────────────────────────────────────────────────────────────────

export const RequirementStatus = z.enum(["satisfied", "partial", "missing"]);
export type RequirementStatus = z.infer<typeof RequirementStatus>;

export const ReviewFinding = z.object({
  requirementId: z.string(),
  status: RequirementStatus,
  evidence: z
    .string()
    .describe("Cite the file and symbol that satisfies it, or state what is absent"),
  remediationTitle: z
    .string()
    .describe("Imperative title for a task that would fix this; empty string if satisfied"),
  remediationFiles: z.array(z.string()).describe("Files a fix would touch; [] if satisfied"),
});
export type ReviewFinding = z.infer<typeof ReviewFinding>;

export const ReviewVerdict = z.object({
  findings: z.array(ReviewFinding),
  assessment: z.string().describe("Two sentences on the overall state of the generated app"),
});
export type ReviewVerdict = z.infer<typeof ReviewVerdict>;

import OpenAI from "openai";
import type { AgentConfig } from "../config.ts";

/**
 * The agent speaks OpenAI's wire protocol and points it at Gemini's
 * OpenAI-compatible endpoint. One SDK, any compatible provider, no vendor
 * abstraction layer of our own — the compatibility layer *is* the abstraction.
 */
export function createLlmClient(config: AgentConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.requestTimeoutMs,
    // The SDK already retries 429/5xx with Retry-After awareness, which is
    // exactly the free-tier failure mode. No need to hand-roll backoff.
    maxRetries: config.transportRetries,
  });
}

export interface ResolvedModels {
  /** High-volume role: per-file generation and repair. */
  readonly worker: string;
  /** Low-volume, high-leverage roles: planning and review. */
  readonly planner: string;
  /** Whether the worker model was auto-selected rather than configured. */
  readonly workerAutoSelected: boolean;
}

export class ModelResolutionError extends Error {}

/**
 * Model families that exist in the catalog but cannot do the job: embeddings,
 * media generation, and realtime audio variants.
 */
const NOT_A_TEXT_MODEL = /embedding|imagen|image|veo|tts|audio|live|aqa/i;

/**
 * Ordered preference for auto-selection. Earlier patterns win. Aliases like
 * `*-latest` are preferred over pinned versions so the agent tracks the
 * provider's current default instead of drifting onto a retired snapshot.
 */
const WORKER_PREFERENCE: readonly RegExp[] = [
  /^gemini-flash-latest$/i,
  /^gemini-[\d.]+-flash$/i,
  /^gemini-[\d.]+-flash-lite$/i,
  /flash/i,
  /^gpt-[\w.]*mini$/i,
  /^gemini-/i,
  /^gpt-/i,
];

function normalizeId(id: string): string {
  // Gemini returns catalog entries as `models/gemini-…`; chat completions want
  // the bare id.
  return id.startsWith("models/") ? id.slice("models/".length) : id;
}

async function fetchCatalog(client: OpenAI): Promise<string[]> {
  try {
    const page = await client.models.list();
    return page.data.map((entry) => normalizeId(entry.id)).sort();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ModelResolutionError(
      `Could not list models from ${client.baseURL}. Check the API key and base URL.\n  ${detail}`,
    );
  }
}

function pickWorker(catalog: readonly string[]): string {
  const usable = catalog.filter((id) => !NOT_A_TEXT_MODEL.test(id));

  for (const pattern of WORKER_PREFERENCE) {
    const hit = usable.find((id) => pattern.test(id));
    if (hit !== undefined) return hit;
  }

  const fallback = usable[0];
  if (fallback === undefined) {
    throw new ModelResolutionError(
      `No usable text-generation model in the provider catalog (${catalog.length} entries). ` +
        `Set LLM_MODEL explicitly.`,
    );
  }
  return fallback;
}

function assertAvailable(requested: string, catalog: readonly string[], envVar: string): string {
  if (catalog.includes(requested)) return requested;

  const suggestions = catalog.filter((id) => !NOT_A_TEXT_MODEL.test(id));
  throw new ModelResolutionError(
    `${envVar}=${requested} is not available to this API key.\n` +
      `Available text models:\n${suggestions.map((id) => `  ${id}`).join("\n")}`,
  );
}

/**
 * Startup preflight. Doubles as a credential check: if the key is wrong, the
 * run fails here in one cheap request instead of midway through generation.
 *
 * Unset models are resolved from the live catalog rather than defaulted to a
 * hardcoded id — provider catalogs are retired on their own schedule, and a
 * stale constant turns into a confusing 404 for whoever runs this next.
 */
export async function resolveModels(client: OpenAI, config: AgentConfig): Promise<ResolvedModels> {
  const catalog = await fetchCatalog(client);

  const worker =
    config.model === undefined
      ? pickWorker(catalog)
      : assertAvailable(config.model, catalog, "LLM_MODEL");

  const planner =
    config.plannerModel === undefined
      ? worker
      : assertAvailable(config.plannerModel, catalog, "LLM_PLANNER_MODEL");

  return { worker, planner, workerAutoSelected: config.model === undefined };
}

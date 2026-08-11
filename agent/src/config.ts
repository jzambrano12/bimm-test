import { config as loadDotenv } from "dotenv";

// `quiet` suppresses dotenv's startup banner — the CLI's stdout is parseable
// output, not a place for third-party chatter.
loadDotenv({ quiet: true });

/**
 * Runtime configuration, resolved once at startup from env + CLI flags.
 *
 * Model IDs are deliberately optional: provider catalogs change faster than
 * take-home assignments, so an unset model is resolved against the provider's
 * /models endpoint at startup rather than hardcoded to a guess that may have
 * been retired. See llm/client.ts.
 */
export interface AgentConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  /** Undefined means "auto-select a fast model from the provider catalog". */
  readonly model: string | undefined;
  /** Undefined means "reuse whatever `model` resolved to". */
  readonly plannerModel: string | undefined;
  readonly maxRepairs: number;
  readonly concurrency: number;
  readonly requestTimeoutMs: number;
  readonly transportRetries: number;
  readonly cacheEnabled: boolean;
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export class ConfigError extends Error {}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ConfigError(
      `${name} must be an integer between ${min} and ${max}, got ${JSON.stringify(raw)}`,
    );
  }
  return parsed;
}

function readOptional(name: string): string | undefined {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? undefined : raw.trim();
}

/**
 * Key resolution is ordered, not exclusive: the agent's default provider is
 * Gemini, but pointing LLM_BASE_URL at any OpenAI-compatible API and supplying
 * OPENAI_API_KEY works without touching code. That keeps the demo runnable for
 * a reviewer who only has one kind of key.
 */
function resolveApiKey(): string {
  const candidates = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY"] as const;

  for (const name of candidates) {
    const value = readOptional(name);
    if (value !== undefined) return value;
  }

  throw new ConfigError(
    `No API key found. Set one of ${candidates.join(", ")} in agent/.env ` +
      `(copy agent/.env.example). A free Gemini key: https://aistudio.google.com/apikey`,
  );
}

export function loadConfig(): AgentConfig {
  return {
    apiKey: resolveApiKey(),
    baseUrl: readOptional("LLM_BASE_URL") ?? DEFAULT_BASE_URL,
    model: readOptional("LLM_MODEL"),
    plannerModel: readOptional("LLM_PLANNER_MODEL"),
    maxRepairs: readInt("AGENT_MAX_REPAIRS", 3, 0, 10),
    concurrency: readInt("AGENT_CONCURRENCY", 2, 1, 8),
    requestTimeoutMs: readInt("AGENT_REQUEST_TIMEOUT_MS", 120_000, 5_000, 600_000),
    transportRetries: readInt("AGENT_TRANSPORT_RETRIES", 4, 0, 8),
    cacheEnabled: readOptional("AGENT_CACHE") !== "0",
  };
}

import OpenAI, { APIError } from "openai";
import type { UsageLedger, LlmPhase } from "./usage.ts";

export interface CompletionRequest {
  readonly model: string;
  readonly phase: LlmPhase;
  readonly system: string;
  readonly user: string;
  /** Low by default: this agent wants reproducible code, not prose variety. */
  readonly temperature?: number;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * Turns provider failures into something the caller can act on.
 *
 * The distinction that matters on a free tier: a 429 the SDK already retried
 * and still failed is almost always an exhausted *daily* quota, not a
 * per-minute burst. Retrying that in our own loop just burns wall-clock, so it
 * surfaces as non-retryable with the provider's own explanation attached.
 */
function wrapError(error: unknown, model: string): LlmError {
  if (error instanceof APIError) {
    const status = error.status ?? 0;

    if (status === 429) {
      return new LlmError(
        `Provider rate limit or quota exhausted for ${model} after SDK retries. ` +
          `On a free tier this usually means the daily request quota is spent — ` +
          `check https://aistudio.google.com/ or set LLM_MODEL to a lighter model.\n  ${error.message}`,
        false,
      );
    }
    if (status === 401 || status === 403) {
      return new LlmError(`Provider rejected the API key (${status}).\n  ${error.message}`, false);
    }
    if (status === 404) {
      return new LlmError(
        `Model ${model} not found at this endpoint (404). The startup preflight passed, ` +
          `so the catalog and the chat endpoint disagree — set LLM_MODEL explicitly.\n  ${error.message}`,
        false,
      );
    }
    return new LlmError(`Provider error ${status} for ${model}: ${error.message}`, status >= 500);
  }

  const detail = error instanceof Error ? error.message : String(error);
  return new LlmError(`Request to ${model} failed: ${detail}`, true);
}

/**
 * One plain-text completion, with usage recorded against a phase.
 *
 * Structured (schema-constrained) calls go through llm/structured.ts; this is
 * the escape hatch for the rare prompt whose output is genuinely free-form.
 */
export async function completeText(
  client: OpenAI,
  ledger: UsageLedger,
  request: CompletionRequest,
): Promise<string> {
  let response;
  try {
    response = await client.chat.completions.create({
      model: request.model,
      temperature: request.temperature ?? 0.1,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    });
  } catch (error) {
    throw wrapError(error, request.model);
  }

  ledger.record(request.phase, {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  });

  const content = response.choices[0]?.message.content;
  if (content === null || content === undefined || content.trim() === "") {
    const reason = response.choices[0]?.finish_reason ?? "unknown";
    throw new LlmError(
      `${request.model} returned an empty completion (finish_reason: ${reason}).`,
      true,
    );
  }

  return content;
}

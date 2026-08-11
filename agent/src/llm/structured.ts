import OpenAI, { APIError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { LlmError, toLlmError } from "./complete.ts";
import type { LlmPhase, UsageLedger } from "./usage.ts";

export class StructuredOutputError extends Error {}

export interface StructuredRequest<T> {
  readonly model: string;
  readonly phase: LlmPhase;
  readonly system: string;
  readonly user: string;
  readonly schema: z.ZodType<T>;
  /** Schema name sent to the provider; also used in error messages. */
  readonly schemaName: string;
  readonly temperature?: number;
}

/**
 * Some providers wrap JSON in markdown despite being asked for raw JSON. Cheap
 * to tolerate, expensive to debug if you don't.
 */
export function stripFences(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
}

/**
 * True when the provider rejected our JSON Schema rather than our prompt.
 *
 * The OpenAI-compatible layers of non-OpenAI providers implement a subset of
 * JSON Schema, and the unsupported-keyword failure is a 400 — indistinguishable
 * from a bad request unless you read the message. Detecting it lets us degrade
 * to plain JSON mode instead of failing the run.
 */
function isSchemaRejection(error: unknown): boolean {
  // Errors reach here already wrapped by toLlmError, which preserves the
  // provider's own error as `cause`. Unwrap one level before inspecting.
  const original = error instanceof LlmError ? error.cause : error;
  if (!(original instanceof APIError) || original.status !== 400) return false;

  return /schema|response_format|json_schema|unsupported/i.test(original.message);
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

async function callOnce(
  client: OpenAI,
  ledger: UsageLedger,
  phase: LlmPhase,
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<string> {
  let response;
  try {
    response = await client.chat.completions.create(params);
  } catch (error) {
    throw toLlmError(error, params.model);
  }

  ledger.record(phase, {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  });

  const content = response.choices[0]?.message.content;
  if (content === null || content === undefined || content.trim() === "") {
    const reason = response.choices[0]?.finish_reason ?? "unknown";
    throw new LlmError(
      `${params.model} returned an empty completion (finish_reason: ${reason}). ` +
        `A 'length' reason means the output hit the token ceiling — the requested file is too large.`,
      true,
    );
  }
  return content;
}

/**
 * A schema-constrained LLM call, with three layers of defence in the order that
 * costs least first:
 *
 *   1. Provider-side constraint — strict JSON Schema derived from the Zod type.
 *      The model physically cannot emit a wrong shape.
 *   2. Schema-support fallback — if the provider rejects the schema itself,
 *      degrade to plain JSON mode with the schema inlined in the prompt.
 *   3. Client-side reparse — validate with Zod anyway, and on failure give the
 *      model its own invalid output plus the exact validation errors, once.
 *
 * Layer 1 usually makes 2 and 3 dead code. They exist because "usually" is not
 * a property you want load-bearing in an unattended loop.
 */
export async function completeStructured<T>(
  client: OpenAI,
  ledger: UsageLedger,
  request: StructuredRequest<T>,
): Promise<T> {
  const jsonSchema = zodResponseFormat(request.schema, request.schemaName);
  const temperature = request.temperature ?? 0.1;

  const baseMessages = [
    { role: "system" as const, content: request.system },
    { role: "user" as const, content: request.user },
  ];

  let raw: string;
  try {
    raw = await callOnce(client, ledger, request.phase, {
      model: request.model,
      temperature,
      messages: baseMessages,
      response_format: jsonSchema,
    });
  } catch (error) {
    if (!isSchemaRejection(error)) throw error;

    // Layer 2: the provider cannot honour this schema. Inline it and ask nicely.
    raw = await callOnce(client, ledger, request.phase, {
      model: request.model,
      temperature,
      messages: [
        ...baseMessages,
        {
          role: "system" as const,
          content:
            `Return ONLY a JSON object conforming to this JSON Schema. ` +
            `No markdown, no commentary.\n\n${JSON.stringify(jsonSchema.json_schema.schema)}`,
        },
      ],
      response_format: { type: "json_object" },
    });
  }

  const firstAttempt = parse(raw, request);
  if (firstAttempt.ok) return firstAttempt.value;

  // Layer 3: one correction round. The model sees exactly what it got wrong,
  // which is far more effective than re-rolling the same prompt and hoping.
  const corrected = await callOnce(client, ledger, request.phase, {
    model: request.model,
    temperature,
    messages: [
      ...baseMessages,
      { role: "assistant" as const, content: raw },
      {
        role: "user" as const,
        content:
          `That response did not satisfy the required schema:\n${firstAttempt.problem}\n\n` +
          `Return the corrected JSON object only. Keep everything that was already valid.`,
      },
    ],
    response_format: jsonSchema,
  });

  const secondAttempt = parse(corrected, request);
  if (secondAttempt.ok) return secondAttempt.value;

  throw new StructuredOutputError(
    `${request.model} could not produce a valid ${request.schemaName} after one correction round.\n` +
      `${secondAttempt.problem}`,
  );
}

type ParseOutcome<T> = { ok: true; value: T } | { ok: false; problem: string };

function parse<T>(raw: string, request: StructuredRequest<T>): ParseOutcome<T> {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch (error) {
    return {
      ok: false,
      problem: `Response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const result = request.schema.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, problem: formatZodIssues(result.error) };
}

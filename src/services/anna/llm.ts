import { connectAnna } from "./runtime";
import type { AnnaClient } from "./runtime";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string | LlmContentBlock[];
}

// MCP-shaped content blocks. Text and image blocks may be mixed in one
// user message (Anna host ≥ 1.1.0-beta.169, llm.complete multimodal):
//   { type: 'text', text: '...' }
//   { type: 'image', data: '<raw base64 or data: URI>', mimeType: 'image/jpeg' }
//   { type: 'image', url: 'https://...' }  (public HTTPS only, SSRF-gated)
// Max 20 MB per image; MIME must be image/jpeg|png|gif|webp|bmp|svg+xml.
// Image blocks are only allowed in user messages.
export type LlmContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType?: string }
  | { type: "image"; url: string };

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  modelPreferences?: {
    hints?: unknown;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
}

export interface LlmResult {
  text: string;
  raw: unknown;
}

export class LlmUnavailableError extends Error {
  constructor(message = "The AI helper is taking a tiny break") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

// Thrown when the resolved model cannot see images (host fail-fast
// APP_MODEL_NOT_VISION_CAPABLE, -32019). Images are never silently
// dropped, so the UI can tell the user to pick a vision model.
export class LlmVisionNotCapableError extends Error {
  readonly code = "APP_MODEL_NOT_VISION_CAPABLE";
  constructor(message = "This model cannot see images") {
    super(message);
    this.name = "LlmVisionNotCapableError";
  }
}

export function isVisionNotCapableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = error instanceof Error ? error.message : "";
  const data = record.data;
  const dataText =
    data && typeof data === "object"
      ? JSON.stringify(data)
      : typeof data === "string"
        ? data
        : "";
  return (
    code.includes("APP_MODEL_NOT_VISION_CAPABLE") ||
    message.includes("APP_MODEL_NOT_VISION_CAPABLE") ||
    dataText.includes("APP_MODEL_NOT_VISION_CAPABLE")
  );
}

export interface LlmService {
  readonly available: boolean;
  complete(request: LlmRequest): Promise<LlmResult>;
}

function unwrapResult(result: unknown): unknown {
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if ("result" in record) return record.result;
    if ("data" in record) return record.data;
    if ("value" in record) return record.value;
  }
  return result;
}

function extractText(response: unknown): string {
  const value = unwrapResult(response);
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;

  // Handle content-block format: {type:"text", text:"..."} (top-level or nested)
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }

  const keys = ["text", "content", "message", "output"];
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
    // Handle nested content block: {content: {type:"text", text:"..."}}
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      if (nested.type === "text" && typeof nested.text === "string") return nested.text;
      if (typeof nested.text === "string") return nested.text;
    }
  }
  return "";
}

// Anna Host API wrapper only. AI behavior (prompts, caption generation)
// arrives with the caption feature, on top of this service.
export async function getLlmService(): Promise<LlmService> {
  const runtime = await connectAnna();
  const client: AnnaClient | null = runtime.client;
  const available =
    runtime.state === "connected" && !!client && !!client.llm && typeof client.llm.complete === "function";
  return {
    available,
    async complete(request: LlmRequest): Promise<LlmResult> {
      if (!available || !client || !client.llm || !client.llm.complete) {
        throw new LlmUnavailableError();
      }
      let response: unknown;
      try {
        response = await client.llm.complete({
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          response_format: request.json ? { type: "json_object" } : undefined,
          modelPreferences: request.modelPreferences,
        });
      } catch (error) {
        if (isVisionNotCapableError(error)) {
          throw new LlmVisionNotCapableError();
        }
        throw error;
      }
      return { text: extractText(response), raw: response };
    },
  };
}

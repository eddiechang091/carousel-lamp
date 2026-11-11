// LLM client for the AI caption feature, backed by the same-origin
// /api/llm proxy (Vercel serverless function) which calls Otari.
// The browser never sees the Otari API key. The model is picked from
// the server-provided allowlist (GET /api/llm) — the browser never
// invents one; the proxy rejects anything outside the list. Every
// successful call records its token usage to localStorage (see
// usage.ts) so the Model dashboard can chart it. All errors surface
// as LlmUnavailableError carrying the proxy's message, so the UI can
// show it.

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string | LlmContentBlock[];
}

// Content blocks, same shape the caption prompt builder produces.
// Text and image blocks may be mixed in one user message:
//   { type: 'text', text: '...' }
//   { type: 'image', data: '<data: URI>' }
//   { type: 'image', url: 'https://...' }
// The proxy translates image blocks to OpenAI image_url parts before
// calling Otari. Max 20 MB per image, like the Otari input limit.
export type LlmContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType?: string }
  | { type: "image"; url: string };

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  /** One model from the server allowlist; omit for the server default. */
  model?: string;
  /** Ask Otari to run its built-in web search for this call. */
  search?: boolean;
}

export interface LlmResult {
  text: string;
  raw: unknown;
  /** Token usage from the proxy, when the upstream response carried it. */
  usage?: TokenUsage | null;
  /** The model that actually answered, when the proxy reported it. */
  model?: string;
  /** True when the proxy's search-enabled attempt answered. */
  searched?: boolean;
}

export class LlmUnavailableError extends Error {
  constructor(message = "The AI caption service is unavailable right now") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export interface LlmService {
  readonly available: boolean;
  complete(request: LlmRequest): Promise<LlmResult>;
}

import { recordUsage } from "./usage";

const PROXY_URL = "/api/llm";
const TIMEOUT_MS = 30000;

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  return "";
}

function extractUsage(data: unknown): TokenUsage | null {
  if (!data || typeof data !== "object") return null;
  const usage = (data as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  if (
    typeof u.prompt_tokens !== "number" ||
    typeof u.completion_tokens !== "number" ||
    typeof u.total_tokens !== "number"
  ) {
    return null;
  }
  return {
    prompt_tokens: u.prompt_tokens,
    completion_tokens: u.completion_tokens,
    total_tokens: u.total_tokens,
  };
}

function extractModel(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const model = (data as Record<string, unknown>).model;
  return typeof model === "string" && model ? model : undefined;
}

// The proxy is always reachable from the deployed app, so the service
// reports available; a missing key or model on the server side comes
// back as an HTTP error and is thrown as LlmUnavailableError.
export async function getLlmService(): Promise<LlmService> {
  return {
    available: true,
    async complete(request: LlmRequest): Promise<LlmResult> {
      let response: Response;
      try {
        response = await fetch(PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: request.messages,
            maxTokens: request.maxTokens,
            temperature: request.temperature,
            model: request.model,
            search: request.search,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw new LlmUnavailableError("The AI caption service timed out — try again");
        }
        throw new LlmUnavailableError();
      }
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        const serverMessage =
          data && typeof data === "object" && typeof (data as Record<string, unknown>).error === "string"
            ? ((data as Record<string, unknown>).error as string)
            : "";
        throw new LlmUnavailableError(serverMessage || `AI caption failed (HTTP ${response.status})`);
      }
      const usage = extractUsage(data);
      const model = extractModel(data);
      if (usage && model) {
        recordUsage({ t: Date.now(), model, tokens: usage.total_tokens });
      }
      const searched =
        data && typeof data === "object" && (data as Record<string, unknown>).searched === true;
      return { text: extractText(data), raw: data, usage, model, searched };
    },
  };
}

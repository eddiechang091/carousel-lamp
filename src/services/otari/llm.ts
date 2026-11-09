// LLM client for the AI caption feature, backed by the same-origin
// /api/llm proxy (Vercel serverless function) which calls Otari.
// The browser never sees the Otari API key and never names a model —
// the model is picked server-side from OTARI_MODEL /
// OTARI_FALLBACK_MODEL. All errors surface as LlmUnavailableError
// carrying the proxy's message, so the UI can show it.

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

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResult {
  text: string;
  raw: unknown;
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

const PROXY_URL = "/api/llm";
const TIMEOUT_MS = 30000;

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  return "";
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
      return { text: extractText(data), raw: data };
    },
  };
}

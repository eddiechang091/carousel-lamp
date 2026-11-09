// Vercel serverless proxy: POST /api/llm -> Otari chat completions.
//
// The Otari API key lives only in the server environment
// (OTARI_API_KEY). It is never sent to the browser, never logged, and
// never included in any response. The model is also server-side only:
// OTARI_MODEL, with OTARI_FALLBACK_MODEL retried once on failure
// (multi-provider routing). No model ID is hardcoded anywhere.
//
// Base URL defaults to the US endpoint and can be overridden for EU
// accounts (OTARI_BASE_URL=https://eu.api.otari.ai/api/v1).

const DEFAULT_BASE_URL = "https://api.otari.ai/api/v1";
const ATTEMPT_TIMEOUT_MS = 12000;
const MAX_TOKENS_CAP = 200;

type TextBlock = { type: "text"; text: string };
type ImageBlock =
  | { type: "image"; data: string; mimeType?: string }
  | { type: "image"; url: string };
type ContentBlock = TextBlock | ImageBlock;

interface IncomingMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

interface OutgoingContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface OutgoingMessage {
  role: "system" | "user" | "assistant";
  content: string | OutgoingContentPart[];
}

type HandlerReq = {
  method?: string;
  body?: unknown;
};

type HandlerRes = {
  status: (code: number) => HandlerRes;
  json: (payload: unknown) => void;
};

function jsonError(res: HandlerRes, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function readBody(req: HandlerReq): unknown {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as unknown;
    } catch {
      return undefined;
    }
  }
  return req.body;
}

function isValidRole(role: unknown): role is IncomingMessage["role"] {
  return role === "system" || role === "user" || role === "assistant";
}

// Convert the client-side content blocks to OpenAI chat format.
// Image blocks become image_url parts; the data URL (e.g. a 440x520
// JPEG preview) is passed through unchanged.
function convertMessages(messages: IncomingMessage[]): OutgoingMessage[] | null {
  const out: OutgoingMessage[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || !isValidRole(message.role)) return null;
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) return null;
    const parts: OutgoingContentPart[] = [];
    for (const block of message.content) {
      if (!block || typeof block !== "object") return null;
      if (block.type === "text" && typeof block.text === "string") {
        parts.push({ type: "text", text: block.text });
      } else if (block.type === "image" && "data" in block && typeof block.data === "string" && block.data) {
        parts.push({ type: "image_url", image_url: { url: block.data } });
      } else if (block.type === "image" && "url" in block && typeof block.url === "string" && block.url) {
        parts.push({ type: "image_url", image_url: { url: block.url } });
      }
      // Unknown block types are dropped, never forwarded.
    }
    if (parts.length === 0) return null;
    out.push({ role: message.role, content: parts });
  }
  return out;
}

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const choices = (data as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = (choices[0] as Record<string, unknown>)?.message;
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { type: string; text?: string } =>
          !!part && typeof part === "object" && (part as { type?: unknown }).type === "text",
      )
      .map((part) => part.text ?? "")
      .join("");
  }
  return "";
}

function upstreamErrorMessage(status: number): string {
  if (status === 401) return "Otari rejected the API key — check OTARI_API_KEY in the Vercel dashboard.";
  if (status === 421)
    return "Otari region mismatch — this key belongs to the other region, check OTARI_BASE_URL.";
  if (status === 429) return "Otari is rate-limited right now — try again shortly.";
  return `Otari request failed (HTTP ${status}).`;
}

async function callOtari(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: OutgoingMessage[],
  maxTokens: number,
  temperature: number,
): Promise<{ ok: boolean; status: number; text: string }> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 0, text: "" };
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) return { ok: false, status: response.status, text: "" };
  return { ok: true, status: response.status, text: extractText(data) };
}

export default async function handler(req: HandlerReq, res: HandlerRes): Promise<void> {
  if (req.method !== "POST") {
    jsonError(res, 405, "Method not allowed — POST { messages } to /api/llm.");
    return;
  }
  const body = readBody(req);
  if (!body || typeof body !== "object") {
    jsonError(res, 400, "Invalid request body — expected { messages }.");
    return;
  }
  const record = body as Record<string, unknown>;
  const incoming = record.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    jsonError(res, 400, "Invalid request — messages must be a non-empty array.");
    return;
  }
  const messages = convertMessages(incoming as IncomingMessage[]);
  if (!messages) {
    jsonError(res, 400, "Invalid messages — check roles and content blocks.");
    return;
  }
  const maxTokens =
    typeof record.maxTokens === "number" && record.maxTokens > 0
      ? Math.min(Math.floor(record.maxTokens), MAX_TOKENS_CAP)
      : 60;
  const temperature =
    typeof record.temperature === "number"
      ? Math.min(Math.max(record.temperature, 0), 2)
      : 0.9;

  const apiKey = process.env.OTARI_API_KEY;
  if (!apiKey) {
    jsonError(
      res,
      503,
      "AI captions are not configured yet — set OTARI_API_KEY in the Vercel dashboard (Project → Settings → Environment Variables).",
    );
    return;
  }
  const model = process.env.OTARI_MODEL;
  if (!model) {
    jsonError(
      res,
      503,
      "AI captions are not configured yet — set OTARI_MODEL in the Vercel dashboard (Project → Settings → Environment Variables).",
    );
    return;
  }
  const fallbackModel = process.env.OTARI_FALLBACK_MODEL || "";
  const baseUrl = (process.env.OTARI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  // Log only the outcome and the model used — never the key, never the
  // request body (it carries image data URLs).
  const primary = await callOtari(baseUrl, apiKey, model, messages, maxTokens, temperature);
  if (primary.ok) {
    console.log(`[api/llm] ok model=${model}`);
    res.status(200).json({ text: primary.text });
    return;
  }
  if (fallbackModel && fallbackModel !== model) {
    console.log(`[api/llm] primary failed status=${primary.status} model=${model}, retrying fallback model=${fallbackModel}`);
    const fallback = await callOtari(baseUrl, apiKey, fallbackModel, messages, maxTokens, temperature);
    if (fallback.ok) {
      console.log(`[api/llm] ok model=${fallbackModel} (fallback)`);
      res.status(200).json({ text: fallback.text });
      return;
    }
    console.log(`[api/llm] fallback failed status=${fallback.status} model=${fallbackModel}`);
    jsonError(res, 502, upstreamErrorMessage(fallback.status || primary.status));
    return;
  }
  if (primary.status === 0) {
    jsonError(res, 502, "Could not reach Otari — check the network and OTARI_BASE_URL, then try again.");
    return;
  }
  console.log(`[api/llm] failed status=${primary.status} model=${model}`);
  jsonError(res, 502, upstreamErrorMessage(primary.status));
}

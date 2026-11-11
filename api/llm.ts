// Vercel serverless proxy: POST /api/llm -> Otari chat completions,
// GET /api/llm -> the allowed model list for the dashboard picker.
//
// The Otari API key lives only in the server environment
// (OTARI_API_KEY). It is never sent to the browser, never logged, and
// never included in any response. The model is also server-side only.
// No model ID is hardcoded anywhere.
//
// Allowed models: OTARI_MODELS (comma-separated provider/model list)
// when set, else [OTARI_MODEL, OTARI_FALLBACK_MODEL]. The POST body
// may name one of them as `model`; anything else is rejected with 400.
// Add models later by editing the Vercel env var — no code change.
//
// Fallback chain: a call walks the allowlist in order until one model
// answers — the first entry is the primary (OTARI_MODEL when
// OTARI_MODELS is unset), and a failure automatically switches to the
// next model in line. An explicitly picked model is tried first, then
// the rest of the list in order.
//
// Base URL defaults to the US endpoint and can be overridden for EU
// accounts (OTARI_BASE_URL=https://eu.api.otari.ai/api/v1).
//
// A successful POST returns { text, model, usage } where usage is the
// Otari token usage ({ prompt_tokens, completion_tokens, total_tokens })
// or null when the upstream response carries none.

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

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

function getAllowedModels(): string[] {
  const fromEnv = (process.env.OTARI_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return [...new Set(fromEnv)];
  return [process.env.OTARI_MODEL || "", process.env.OTARI_FALLBACK_MODEL || ""].filter(Boolean);
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

function extractModel(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const model = (data as Record<string, unknown>).model;
    if (typeof model === "string" && model) return model;
  }
  return fallback;
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
  search: boolean,
): Promise<{
  ok: boolean;
  status: number;
  text: string;
  usage: TokenUsage | null;
  model: string;
}> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Web search is Otari's own built-in tool (docs/tools.md):
      // `otari_web_search` in the tools array makes the gateway run a
      // live search itself and answer from the results, so any model
      // can quote fresh facts. The gateway runs the tool loop
      // server-side — the client only ever sees the final text.
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(search ? { tools: [{ type: "otari_web_search" }] } : {}),
      }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 0, text: "", usage: null, model };
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) return { ok: false, status: response.status, text: "", usage: null, model };
  return {
    ok: true,
    status: response.status,
    text: extractText(data),
    usage: extractUsage(data),
    model: extractModel(data, model),
  };
}

export default async function handler(req: HandlerReq, res: HandlerRes): Promise<void> {
  if (req.method === "GET") {
    res.status(200).json({ models: getAllowedModels() });
    return;
  }
  if (req.method !== "POST") {
    jsonError(res, 405, "Method not allowed — GET /api/llm lists models, POST { messages } calls one.");
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
  // `search: true` asks Otari to run its built-in web search tool for
  // this call (festival facts). Anything else is treated as false —
  // the default for captions and every other caller.
  const search = record.search === true;

  const apiKey = process.env.OTARI_API_KEY;
  if (!apiKey) {
    jsonError(
      res,
      503,
      "AI captions are not configured yet — set OTARI_API_KEY in the Vercel dashboard (Project → Settings → Environment Variables).",
    );
    return;
  }
  const allowedModels = getAllowedModels();
  const requestedModel =
    typeof record.model === "string" && record.model ? record.model : undefined;
  if (requestedModel && !allowedModels.includes(requestedModel)) {
    jsonError(res, 400, "Unknown model — pick one from the list returned by GET /api/llm.");
    return;
  }
  // Fallback chain: the attempt order is the allowlist in order, with
  // an explicitly picked model moved to the front. The primary is the
  // first entry (OTARI_MODEL when OTARI_MODELS is unset); each failure
  // automatically switches to the next model in line.
  const chain = requestedModel
    ? [requestedModel, ...allowedModels.filter((m) => m !== requestedModel)]
    : allowedModels;
  if (chain.length === 0) {
    jsonError(
      res,
      503,
      "AI captions are not configured yet — set OTARI_MODEL in the Vercel dashboard (Project → Settings → Environment Variables).",
    );
    return;
  }
  const baseUrl = (process.env.OTARI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  // Log only the outcome and the model used — never the key, never the
  // request body (it carries image data URLs).
  let lastHttpStatus = 0;
  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i];
    const isFirst = i === 0;
    // A search-enabled call can fail when the gateway has no search
    // backend behind it (hosted vs self-hosted). That must not take the
    // feature down: retry the same model without the tool, i.e. plain
    // model knowledge, before trying the next model in line.
    const withSearch = search && isFirst;
    const attempt = await callOtari(baseUrl, apiKey, candidate, messages, maxTokens, temperature, withSearch);
    if (attempt.ok) {
      console.log(`[api/llm] ok model=${attempt.model} search=${withSearch} tokens=${attempt.usage?.total_tokens ?? "?"}${isFirst ? "" : " (fallback)"}`);
      res.status(200).json({ text: attempt.text, model: attempt.model, usage: attempt.usage, searched: withSearch });
      return;
    }
    if (attempt.status !== 0) lastHttpStatus = attempt.status;
    if (withSearch) {
      console.log(`[api/llm] search call failed status=${attempt.status} model=${candidate}, retrying without search`);
      const plain = await callOtari(baseUrl, apiKey, candidate, messages, maxTokens, temperature, false);
      if (plain.ok) {
        console.log(`[api/llm] ok model=${plain.model} search=false (search fallback) tokens=${plain.usage?.total_tokens ?? "?"}`);
        res.status(200).json({ text: plain.text, model: plain.model, usage: plain.usage, searched: false });
        return;
      }
      if (plain.status !== 0) lastHttpStatus = plain.status;
    }
    if (i < chain.length - 1) {
      console.log(`[api/llm] model failed status=${lastHttpStatus} model=${candidate}, trying next in chain`);
    }
  }
  if (lastHttpStatus === 0) {
    jsonError(res, 502, "Could not reach Otari — check the network and OTARI_BASE_URL, then try again.");
    return;
  }
  console.log(`[api/llm] all models failed status=${lastHttpStatus}`);
  jsonError(res, 502, upstreamErrorMessage(lastHttpStatus));
}

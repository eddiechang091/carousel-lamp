// Model allowlist + selection for the dashboard.
//
// The list comes from GET /api/llm (server env: OTARI_MODELS, else
// OTARI_MODEL + OTARI_FALLBACK_MODEL) — never hardcoded in the
// browser. The user's pick is stored locally and sent with later
// calls; null means "server default".

const MODELS_URL = "/api/llm";
const SELECTED_MODEL_KEY = "carousel-lamp:otari-model";

export async function fetchAllowedModels(): Promise<string[]> {
  try {
    const response = await fetch(MODELS_URL, { method: "GET" });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return [];
    const models = (data as Record<string, unknown>).models;
    if (!Array.isArray(models)) return [];
    return models.filter(
      (m): m is string => typeof m === "string" && m.length > 0,
    );
  } catch {
    return [];
  }
}

export function readSelectedModel(): string | null {
  try {
    const raw = localStorage.getItem(SELECTED_MODEL_KEY);
    return raw ? raw : null;
  } catch {
    return null;
  }
}

export function saveSelectedModel(model: string | null): void {
  try {
    if (model) localStorage.setItem(SELECTED_MODEL_KEY, model);
    else localStorage.removeItem(SELECTED_MODEL_KEY);
  } catch {
    // Storage unavailable — the pick just lasts for this session.
  }
}

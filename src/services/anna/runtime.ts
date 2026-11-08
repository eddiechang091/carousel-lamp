export type AnnaConnectionState = "connecting" | "connected" | "standalone" | "error";

export interface AnnaClient {
  llm?: { complete?: (input: unknown) => Promise<unknown> };
  storage?: {
    get?: (input: unknown) => Promise<unknown>;
    set?: (input: unknown) => Promise<unknown>;
    delete?: (input: unknown) => Promise<unknown>;
    list?: (input?: unknown) => Promise<unknown>;
  };
  window?: {
    ready?: (input: unknown) => Promise<unknown>;
    set_title?: (input: unknown) => Promise<unknown>;
  };
  tools?: {
    invoke?: (input: { tool_id: string; method: string; args?: unknown }) => Promise<unknown>;
  };
}

export interface AnnaRuntime {
  state: AnnaConnectionState;
  client: AnnaClient | null;
  isHosted: boolean;
}

const SDK_PATH = "/static/anna-apps/_sdk/latest/index.js";

let cached: Promise<AnnaRuntime> | null = null;

export function detectAnnaHost(): boolean {
  if (typeof window === "undefined") return false;
  // The local harness embeds the app in an iframe whose parent is the
  // harness dashboard -- window.parent !== window is true there too, so
  // a same-origin readable parent is not by itself proof of the real host.
  // Only treat the environment as the Anna host when the host SDK or an
  // /anna-apps/ URL is actually present.
  if ("__ANNA_TOOL_IDS__" in window) return true;
  try {
    if (/\/anna-apps\//.test(window.location.pathname)) return true;
  } catch {
    return true;
  }
  return false;
}

export async function connectAnna(): Promise<AnnaRuntime> {
  if (cached) return cached;
  cached = (async (): Promise<AnnaRuntime> => {
    const hosted = detectAnnaHost();
    if (typeof window === "undefined" || !hosted) {
      return { state: "standalone", client: null, isHosted: false };
    }
    try {
      const mod = (await import(/* @vite-ignore */ SDK_PATH)) as {
        AnnaAppRuntime?: { connect: () => Promise<AnnaClient> };
      };
      if (!mod || !mod.AnnaAppRuntime || !mod.AnnaAppRuntime.connect) {
        return { state: "standalone", client: null, isHosted: false };
      }
      const client = await mod.AnnaAppRuntime.connect();
      if (client.window && client.window.ready) {
        await client.window.ready({});
      }
      return { state: "connected", client, isHosted: true };
    } catch (error) {
      console.warn("[anna] runtime connection failed; continuing in standalone mode.", error);
      return { state: "error", client: null, isHosted: hosted };
    }
  })();
  return cached;
}

export function resetAnnaRuntime(): void {
  cached = null;
}

import type { Locale } from "@/i18n";

// Auto-caption runner: one in-flight attempt per slot, deduped.
// The UI (Home) owns the loading/error display and the auto-save;
// this module only decides when to call the model and reports back
// through callbacks, so the trigger conditions are unit-testable
// without rendering the page.
//
// A failed attempt retries once after a short delay: batch uploads
// ask for a caption for every photo, and a transient timeout or 500
// must not silently leave one photo caption-less. After the retry
// fails too, onError fires once and the UI's manual retry takes over.

export type AutoCaptionRequest = {
  imageDataUrl: string;
  locale: Locale;
  /** Skip when the photo already has a saved caption (keep the user's). */
  hasCaption?: boolean;
  /** Retry even if this slot was already attempted. */
  force?: boolean;
  /** One model from the server allowlist; omit for the server default. */
  model?: string;
};

export type AutoCaptionDeps = {
  generate: (opts: {
    imageDataUrl: string;
    locale: Locale;
    model?: string;
  }) => Promise<string>;
  onStart?: (slot: number) => void;
  onCaption?: (slot: number, text: string) => void;
  onError?: (slot: number, error: unknown) => void;
  onDone?: (slot: number) => void;
  /** Delay before the single automatic retry. Defaults to 2000ms. */
  retryDelayMs?: number;
};

const MAX_RETRIES = 1;

export function createAutoCaptionRunner(deps: AutoCaptionDeps) {
  const attempted = new Set<number>();
  const retries = new Map<number, number>();
  const retryDelayMs = deps.retryDelayMs ?? 2000;

  async function attempt(slot: number, req: AutoCaptionRequest): Promise<boolean> {
    deps.onStart?.(slot);
    try {
      const text = await deps.generate({
        imageDataUrl: req.imageDataUrl,
        locale: req.locale,
        model: req.model,
      });
      retries.delete(slot);
      deps.onCaption?.(slot, text);
      deps.onDone?.(slot);
      return true;
    } catch (error) {
      const used = retries.get(slot) ?? 0;
      if (used < MAX_RETRIES) {
        retries.set(slot, used + 1);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        // No onDone here: the retry is the same logical attempt, and
        // the busy flag must stay up until it settles.
        return attempt(slot, req);
      }
      retries.delete(slot);
      deps.onError?.(slot, error);
      deps.onDone?.(slot);
      return false;
    }
  }

  async function request(slot: number, req: AutoCaptionRequest): Promise<void> {
    if (!req.imageDataUrl) return;
    if (req.hasCaption) return;
    if (!req.force && attempted.has(slot)) return;
    attempted.add(slot);
    const ok = await attempt(slot, req);
    if (!ok) attempted.delete(slot);
  }

  return { request };
}

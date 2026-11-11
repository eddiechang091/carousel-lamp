import type { Locale } from "@/i18n";

// Auto-caption runner: one in-flight attempt per slot, deduped.
// The UI (Home) owns the loading/error display and the auto-save;
// this module only decides when to call the model and reports back
// through callbacks, so the trigger conditions are unit-testable
// without rendering the page.

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
};

export function createAutoCaptionRunner(deps: AutoCaptionDeps) {
  const attempted = new Set<number>();

  async function request(slot: number, req: AutoCaptionRequest): Promise<void> {
    if (!req.imageDataUrl) return;
    if (req.hasCaption) return;
    if (!req.force && attempted.has(slot)) return;
    attempted.add(slot);
    deps.onStart?.(slot);
    try {
      const text = await deps.generate({
        imageDataUrl: req.imageDataUrl,
        locale: req.locale,
        model: req.model,
      });
      deps.onCaption?.(slot, text);
    } catch (error) {
      // A failed attempt can be retried (by the inline retry affordance).
      attempted.delete(slot);
      deps.onError?.(slot, error);
    } finally {
      deps.onDone?.(slot);
    }
  }

  return { request };
}

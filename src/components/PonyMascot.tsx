import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/i18n";
import type { ThemeId } from "@/lib/themes";
import {
  askFestivalFacts,
  nudgeAllowed,
  FIRST_NUDGE_IDLE_MS,
  NUDGE_INTERVAL_MS,
  NUDGE_BUBBLE_MS,
} from "@/services/otari/festival";

// 2D pony mascot, bottom-right corner. Code-drawn inline SVG — no
// binary assets. Tap the pony and it asks Otari for the current
// theme's festival background + 2-3 fun facts, shown in a chat bubble.
// Like Money Companion's Lucky Cat, it also nudges on its own after
// 60s idle, then at most every 180s, max 3 per session — only when no
// editor/modal is open and no bubble is showing. Any pointer/key
// activity re-arms the idle timer.
type Bubble =
  | { kind: "nudge"; text: string }
  | { kind: "facts"; text: string }
  | { kind: "error"; text: string };

type Props = {
  themeId: ThemeId;
  /** Picked model from the dashboard; null means server default. */
  model: string | null;
  /** True while any editor/modal is open — the pony stays quiet then. */
  editorOpen: boolean;
};

export default function PonyMascot({ themeId, model, editorOpen }: Props) {
  const { t, locale } = useI18n();
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [loading, setLoading] = useState(false);
  const bubbleRef = useRef(bubble);
  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);
  const editorOpenRef = useRef(editorOpen);
  useEffect(() => {
    editorOpenRef.current = editorOpen;
  }, [editorOpen]);
  const localeRef = useRef<Locale>(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const themeIdRef = useRef(themeId);
  useEffect(() => {
    themeIdRef.current = themeId;
  }, [themeId]);
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const nudgesShownRef = useRef(0);
  const lastNudgeAtRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  function clearNudgeTimer() {
    if (nudgeTimerRef.current !== null) {
      window.clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }

  function scheduleNudge(delay: number) {
    clearNudgeTimer();
    nudgeTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      if (
        nudgeAllowed(nudgesShownRef.current, lastNudgeAtRef.current, now) &&
        !bubbleRef.current &&
        !editorOpenRef.current
      ) {
        nudgesShownRef.current += 1;
        lastNudgeAtRef.current = now;
        setBubble({ kind: "nudge", text: t("pony.nudge") });
        dismissTimerRef.current = window.setTimeout(() => {
          setBubble((current) => (current?.kind === "nudge" ? null : current));
        }, NUDGE_BUBBLE_MS);
      }
      if (nudgesShownRef.current < 3) scheduleNudge(NUDGE_INTERVAL_MS);
    }, delay);
  }

  useEffect(() => {
    scheduleNudge(FIRST_NUDGE_IDLE_MS);
    const onActivity = () => {
      // A tap or keypress restarts the idle clock — but never while the
      // user is reading a bubble.
      if (bubbleRef.current) return;
      scheduleNudge(nudgesShownRef.current === 0 ? FIRST_NUDGE_IDLE_MS : NUDGE_INTERVAL_MS);
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      clearNudgeTimer();
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
    // Mount-only: the timer chain reads everything else through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask() {
    if (loading) return;
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setBubble(null);
    setLoading(true);
    try {
      const text = await askFestivalFacts({
        themeId: themeIdRef.current,
        locale: localeRef.current,
        model: modelRef.current ?? undefined,
      });
      setBubble({ kind: "facts", text });
    } catch {
      setBubble({ kind: "error", text: t("pony.error") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pony-mascot">
      {loading && (
        <div className="pony-bubble" role="status">
          {t("pony.thinking")}
        </div>
      )}
      {!loading && bubble?.kind === "nudge" && (
        <button type="button" className="pony-bubble" onClick={() => void ask()}>
          {bubble.text}
        </button>
      )}
      {!loading && bubble?.kind === "facts" && (
        <div className="pony-bubble" role="status">
          {bubble.text}
          <span className="pony-bubble-note">{t("pony.factsNote")}</span>
        </div>
      )}
      {!loading && bubble?.kind === "error" && (
        <div className="pony-bubble" role="status">
          {bubble.text}
          <button type="button" className="pony-bubble-retry" onClick={() => void ask()}>
            {t("pony.retry")}
          </button>
        </div>
      )}
      <button
        type="button"
        className="pony-button"
        aria-label={t("a11y.pony")}
        onClick={() => {
          if (bubble?.kind === "facts") setBubble(null);
          else void ask();
        }}
      >
        <svg viewBox="0 0 120 100" role="img" aria-hidden="true">
          {/* tail */}
          <path
            d="M22 62 C10 58 6 44 12 34 C14 44 18 50 26 52 C20 56 20 60 22 62 Z"
            fill="#ff9ec4"
          />
          {/* hind + front legs */}
          <rect x="38" y="72" width="8" height="20" rx="4" fill="#f7e8d0" />
          <rect x="52" y="72" width="8" height="20" rx="4" fill="#f2ddbd" />
          <rect x="70" y="72" width="8" height="20" rx="4" fill="#f7e8d0" />
          <rect x="82" y="72" width="8" height="20" rx="4" fill="#f2ddbd" />
          {/* hooves */}
          <rect x="38" y="86" width="8" height="6" rx="3" fill="#8a6d4b" />
          <rect x="52" y="86" width="8" height="6" rx="3" fill="#8a6d4b" />
          <rect x="70" y="86" width="8" height="6" rx="3" fill="#8a6d4b" />
          <rect x="82" y="86" width="8" height="6" rx="3" fill="#8a6d4b" />
          {/* body */}
          <ellipse cx="62" cy="62" rx="32" ry="20" fill="#f7e8d0" />
          {/* mane */}
          <path
            d="M88 24 C76 30 70 46 74 62 L84 60 C80 48 82 36 90 30 Z"
            fill="#ff9ec4"
          />
          {/* neck + head */}
          <path d="M84 30 L96 26 L100 44 L88 48 Z" fill="#f7e8d0" />
          <circle cx="96" cy="34" r="13" fill="#f7e8d0" />
          {/* ears */}
          <path d="M88 24 L86 12 L94 20 Z" fill="#f7e8d0" />
          <path d="M98 22 L100 11 L106 19 Z" fill="#f7e8d0" />
          <path d="M89 22 L88 15 L92 19 Z" fill="#ffb6c1" />
          {/* forelock */}
          <path d="M92 22 C88 26 88 30 90 33 C94 30 96 26 96 22 Z" fill="#ff9ec4" />
          {/* muzzle */}
          <ellipse cx="106" cy="38" rx="8" ry="6" fill="#fbeed6" />
          <circle cx="110" cy="37" r="1.4" fill="#8a6d4b" />
          {/* eye + blush */}
          <circle cx="98" cy="32" r="1.8" fill="#3d2c1e" />
          <circle cx="102" cy="38" r="2.6" fill="#ffb6c1" opacity="0.7" />
          {/* star on the flank */}
          <path
            d="M58 54 L60 59 L65 59 L61 62 L62 67 L58 64 L54 67 L55 62 L51 59 L56 59 Z"
            fill="#e8b84a"
          />
        </svg>
      </button>
    </div>
  );
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nProvider, setLocale } from "@/i18n";
import { AppWrapper } from "@/components/common/PageMeta";
import Home from "@/pages/Home";

// Capture the carousel's onSelect callback so the test can simulate the
// user tapping a frame in the 3D scene.
const selectHooks = vi.hoisted(() => ({
  onSelect: null as ((index: number) => void) | null,
  complete: vi.fn(),
  llmAvailable: true,
}));

vi.mock("@/lib/carousel-scene", () => ({
  createCarousel: vi.fn((_host: unknown, onSelect: (index: number) => void) => {
    selectHooks.onSelect = onSelect;
    return {
      ready: Promise.resolve(),
      focus: vi.fn(),
      reset: vi.fn(),
      wind: vi.fn(),
      rotate: vi.fn(),
      light: vi.fn(),
      selectMode: vi.fn(),
      setPhoto: vi.fn().mockResolvedValue(undefined),
      setCaption: vi.fn().mockResolvedValue(undefined),
      swapPhotos: vi.fn(),
      setTheme: vi.fn(),
      dispose: vi.fn(),
    };
  }),
}));

vi.mock("@/lib/sounds", () => ({
  ChimeAudio: class {
    play = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("@/lib/music-box", () => ({
  MusicBoxAudio: class {
    start = vi.fn();
    stop = vi.fn();
    setVolume = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("@/lib/photo-storage", () => ({
  readSavedPhotos: vi.fn().mockResolvedValue([]),
  savePhotosLocally: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/heic", () => ({
  isHeicFile: vi.fn().mockReturnValue(false),
  convertHeic: vi.fn(),
}));

vi.mock("@/services/anna/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/anna/llm")>();
  return {
    ...actual,
    getLlmService: vi.fn(async () => ({
      available: selectHooks.llmAvailable,
      complete: selectHooks.complete,
    })),
  };
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppWrapper>
    <I18nProvider>{children}</I18nProvider>
  </AppWrapper>
);

async function selectFirstFrame() {
  render(<Home />, { wrapper: Wrapper });
  await waitFor(() => expect(selectHooks.onSelect).not.toBeNull());
  selectHooks.onSelect!(0);
  await screen.findByLabelText("Mood caption");
}

describe("ai caption button", () => {
  beforeEach(() => {
    setLocale("en");
    selectHooks.llmAvailable = true;
    selectHooks.complete.mockReset();
  });

  it("shows the AI button when the LLM is available, disabled on an empty frame", async () => {
    await selectFirstFrame();
    const button = screen.getByRole("button", {
      name: "Generate a poetic caption with AI",
    });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("hides the AI button when the LLM is unavailable (standalone web)", async () => {
    selectHooks.llmAvailable = false;
    await selectFirstFrame();
    expect(
      screen.queryByRole("button", { name: "Generate a poetic caption with AI" }),
    ).not.toBeInTheDocument();
  });
});

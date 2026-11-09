import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, setLocale } from "@/i18n";
import { AppWrapper } from "@/components/common/PageMeta";
import Home from "@/pages/Home";

// Capture the carousel's onSelect callback so the test can simulate the
// user tapping a frame in the 3D scene.
const selectHooks = vi.hoisted(() => ({
  onSelect: null as ((index: number) => void) | null,
  complete: vi.fn(),
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

vi.mock("@/services/otari/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/otari/llm")>();
  return {
    ...actual,
    getLlmService: vi.fn(async () => ({
      available: true,
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
    selectHooks.complete.mockReset();
  });

  it("is always shown now that the host gate is gone", async () => {
    await selectFirstFrame();
    const button = screen.getByRole("button", {
      name: "Generate a poetic caption with AI",
    });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("shows the empty-frame notice and never calls the LLM on an empty frame", async () => {
    await selectFirstFrame();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Generate a poetic caption with AI" }),
    );
    await screen.findByText("This frame is empty — add a photo or a caption first");
    expect(selectHooks.complete).not.toHaveBeenCalled();
  });
});

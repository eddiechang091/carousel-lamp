import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider, setLocale } from "@/i18n";
import PonyMascot from "@/components/PonyMascot";
import { FIRST_NUDGE_IDLE_MS, NUDGE_INTERVAL_MS, NUDGE_BUBBLE_MS } from "@/services/otari/festival";

const completeMock = vi.fn();

vi.mock("@/services/otari/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/otari/llm")>();
  return {
    ...actual,
    getLlmService: vi.fn(async () => ({
      available: true,
      complete: completeMock,
    })),
  };
});

function renderPony(props: Partial<React.ComponentProps<typeof PonyMascot>> = {}) {
  setLocale("en");
  return render(
    <I18nProvider>
      <PonyMascot themeId="christmas" model={null} editorOpen={false} {...props} />
    </I18nProvider>,
  );
}

describe("PonyMascot", () => {
  beforeEach(() => {
    completeMock.mockReset();
    completeMock.mockResolvedValue({
      text: "Christmas celebrates the birth of Jesus. Evergreen trees symbolise eternal life.",
      raw: {},
    });
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks Otari for festival facts when tapped and shows them in a bubble", async () => {
    renderPony();
    fireEvent.click(screen.getByRole("button", { name: /Festival pony/ }));
    await screen.findByText(/Christmas celebrates the birth of Jesus/);
    expect(screen.getByText("Festival facts are AI-generated.")).toBeInTheDocument();
    expect(completeMock).toHaveBeenCalledOnce();
    const request = completeMock.mock.calls[0][0] as { messages: unknown[]; model?: string };
    expect(request.messages).toHaveLength(2);
    expect(request.model).toBeUndefined(); // server default when no pick
  });

  it("shows the live-search note when the facts came from a web search", async () => {
    completeMock.mockResolvedValueOnce({
      text: "Diwali 2026 lit up Jaipur with a record drone show.",
      raw: {},
      searched: true,
    });
    renderPony({ themeId: "diwali" });
    fireEvent.click(screen.getByRole("button", { name: /Festival pony/ }));
    await screen.findByText(/record drone show/);
    expect(screen.getByText("Fresh from a live web search via Otari.")).toBeInTheDocument();
    const request = completeMock.mock.calls[0][0] as { search?: boolean };
    expect(request.search).toBe(true);
  });

  it("sends the dashboard's picked model with the facts request", async () => {
    renderPony({ model: "moonshotai/kimi-k3.1-pro" });
    fireEvent.click(screen.getByRole("button", { name: /Festival pony/ }));
    await screen.findByText(/Christmas celebrates/);
    const request = completeMock.mock.calls[0][0] as { model?: string };
    expect(request.model).toBe("moonshotai/kimi-k3.1-pro");
  });

  it("shows an inline retry when the facts call fails", async () => {
    completeMock.mockRejectedValueOnce(new Error("boom"));
    renderPony();
    fireEvent.click(screen.getByRole("button", { name: /Festival pony/ }));
    await screen.findByText(/Couldn't reach the festival storyteller/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(/Christmas celebrates the birth of Jesus/);
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it("nudges at most 3 times: 60s idle, then every 180s, 12s on screen", async () => {
    vi.useFakeTimers();
    renderPony();
    const nudge = () => screen.queryByText("Psst — tap me for a festival story!");
    expect(nudge()).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(FIRST_NUDGE_IDLE_MS - 1000);
    expect(nudge()).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1000);
    expect(nudge()).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(NUDGE_BUBBLE_MS);
    expect(nudge()).not.toBeInTheDocument();
    // Second nudge 180s after the first.
    await vi.advanceTimersByTimeAsync(NUDGE_INTERVAL_MS - NUDGE_BUBBLE_MS);
    expect(nudge()).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(NUDGE_BUBBLE_MS);
    expect(nudge()).not.toBeInTheDocument();
    // Third nudge, then silence — no fourth.
    await vi.advanceTimersByTimeAsync(NUDGE_INTERVAL_MS - NUDGE_BUBBLE_MS);
    expect(nudge()).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(NUDGE_BUBBLE_MS);
    expect(nudge()).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(NUDGE_INTERVAL_MS * 2);
    expect(nudge()).not.toBeInTheDocument();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("stays quiet while an editor is open", async () => {
    vi.useFakeTimers();
    renderPony({ editorOpen: true });
    await vi.advanceTimersByTimeAsync(FIRST_NUDGE_IDLE_MS + NUDGE_INTERVAL_MS);
    expect(screen.queryByText("Psst — tap me for a festival story!")).not.toBeInTheDocument();
  });

  it("tapping a nudge bubble asks for the facts", async () => {
    vi.useFakeTimers();
    renderPony();
    await vi.advanceTimersByTimeAsync(FIRST_NUDGE_IDLE_MS);
    expect(screen.getByText("Psst — tap me for a festival story!")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Psst — tap me for a festival story!"));
    // Flush the mocked llm promise chain, then assert synchronously —
    // findByText would deadlock under fake timers.
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText(/Christmas celebrates the birth of Jesus/)).toBeInTheDocument();
  });
});

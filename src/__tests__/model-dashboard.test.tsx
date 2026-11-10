import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, setLocale } from "@/i18n";
import ModelDashboard from "@/components/ModelDashboard";
import type { UsageEntry } from "@/services/otari/usage";

const baseProps = {
  open: true,
  models: ["deepseek/deepseek-v4.1-flash-1017", "moonshotai/kimi-k3.1-pro"],
  modelsLoading: false,
  modelsError: false,
  selectedModel: null as string | null,
  onSelectModel: vi.fn(),
  entries: [] as UsageEntry[],
  onInteract: vi.fn(),
  onClose: vi.fn(),
};

function renderDashboard(props: Partial<typeof baseProps> = {}) {
  setLocale("en");
  return render(
    <I18nProvider>
      <ModelDashboard {...baseProps} {...props} />
    </I18nProvider>,
  );
}

describe("ModelDashboard", () => {
  it("lists the server models plus a server-default option", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: "Server default" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "deepseek/deepseek-v4.1-flash-1017" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "moonshotai/kimi-k3.1-pro" }),
    ).toBeInTheDocument();
  });

  it("reports the picked model and marks it selected", async () => {
    const onSelectModel = vi.fn();
    const user = userEvent.setup();
    renderDashboard({ onSelectModel, selectedModel: "moonshotai/kimi-k3.1-pro" });
    const picked = screen.getByRole("button", { name: "moonshotai/kimi-k3.1-pro" });
    expect(picked).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Server default" }));
    expect(onSelectModel).toHaveBeenCalledWith(null);
  });

  it("shows loading, error and empty states for the model list", () => {
    const { rerender } = renderDashboard({ modelsLoading: true, models: [] });
    expect(screen.getByText("Loading models…")).toBeInTheDocument();
    rerender(
      <I18nProvider>
        <ModelDashboard {...baseProps} modelsError models={[]} />
      </I18nProvider>,
    );
    expect(screen.getByText("Couldn't load the model list")).toBeInTheDocument();
    rerender(
      <I18nProvider>
        <ModelDashboard {...baseProps} models={[]} />
      </I18nProvider>,
    );
    expect(screen.getByText("No models configured yet")).toBeInTheDocument();
  });

  it("shows an empty state without usage and a chart with it", () => {
    const { rerender } = renderDashboard();
    expect(screen.getByText(/No AI calls yet/)).toBeInTheDocument();
    rerender(
      <I18nProvider>
        <ModelDashboard
          {...baseProps}
          entries={[
            { t: 1, model: "acme/vision-1", tokens: 10 },
            { t: 2, model: "acme/vision-1", tokens: 25 },
          ]}
        />
      </I18nProvider>,
    );
    expect(screen.queryByText(/No AI calls yet/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Token usage/ })).toBeInTheDocument();
    expect(screen.getByText("Latest: 25 tokens · acme/vision-1")).toBeInTheDocument();
  });

  it("is hidden when closed", () => {
    renderDashboard({ open: false });
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveAttribute("aria-hidden", "true");
    expect(dialog).not.toHaveClass("open");
  });

  it("calls onClose from the X button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDashboard({ open: true, onClose });
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

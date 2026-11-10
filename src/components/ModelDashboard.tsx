import { X } from "lucide-react";
import { useI18n } from "@/i18n";
import type { UsageEntry } from "@/services/otari/usage";
import UsageChart from "./UsageChart";

// Model dashboard: a translucent overlay in the same spot as the
// caption editor popup. Model picker (list from the server, never
// hardcoded) + token-usage line chart. Fade is CSS opacity on the
// wrapper (.model-dashboard / .open); the 10s auto-hide timer lives
// in Home and resets on any pointer/key interaction inside (onInteract).
type Props = {
  open: boolean;
  models: string[];
  modelsLoading: boolean;
  modelsError: boolean;
  selectedModel: string | null;
  onSelectModel: (model: string | null) => void;
  entries: UsageEntry[];
  onInteract: () => void;
  onClose: () => void;
};

export default function ModelDashboard({
  open,
  models,
  modelsLoading,
  modelsError,
  selectedModel,
  onSelectModel,
  entries,
  onInteract,
  onClose,
}: Props) {
  const { t } = useI18n();
  const last = entries[entries.length - 1];
  return (
    <div
      className={`model-dashboard${open ? " open" : ""}`}
      role="dialog"
      aria-label={t("model.dashboardTitle")}
      aria-hidden={!open}
      onPointerDown={onInteract}
      onKeyDown={onInteract}
    >
      <div className="model-dashboard-head">
        <h2>{t("model.dashboardTitle")}</h2>
        <button
          type="button"
          className="model-dashboard-close"
          aria-label={t("model.close")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <section className="model-picker" aria-label={t("model.title")}>
        {modelsLoading ? (
          <p className="model-status">{t("model.loading")}</p>
        ) : modelsError ? (
          <p className="model-status">{t("model.error")}</p>
        ) : models.length === 0 ? (
          <p className="model-status">{t("model.noModels")}</p>
        ) : (
          <ul className="model-list">
            <li>
              <button
                type="button"
                className={selectedModel === null ? "selected" : ""}
                aria-pressed={selectedModel === null}
                onClick={() => onSelectModel(null)}
              >
                {t("model.default")}
              </button>
            </li>
            {models.map((model) => (
              <li key={model}>
                <button
                  type="button"
                  className={selectedModel === model ? "selected" : ""}
                  aria-pressed={selectedModel === model}
                  onClick={() => onSelectModel(model)}
                >
                  {model}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="model-usage" aria-label={t("model.usageTitle")}>
        <h3>{t("model.usageTitle")}</h3>
        {entries.length === 0 ? (
          <p className="model-status">{t("model.noUsage")}</p>
        ) : (
          <>
            <UsageChart entries={entries} />
            {last && (
              <p className="model-usage-latest">
                {t("model.latest", {
                  tokens: String(last.tokens),
                  model: last.model,
                })}
              </p>
            )}
          </>
        )}
        <p className="model-note">{t("model.usageNote")}</p>
      </section>
    </div>
  );
}

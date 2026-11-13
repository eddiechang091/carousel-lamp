import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { I18nProvider, translate } from "./i18n";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

function ErrorFallback() {
  return <p>{translate("error.appCrashed")}</p>;
}

// Register the PWA service worker after the first load so it never
// competes with the initial render.
function registerPwa() {
  void registerServiceWorker();
}
if (document.readyState === "complete") {
  registerPwa();
} else {
  window.addEventListener("load", registerPwa);
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <AppWrapper>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AppWrapper>
  </Sentry.ErrorBoundary>
);

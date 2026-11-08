import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { I18nProvider, translate } from "./i18n";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

function ErrorFallback() {
  return <p>{translate("error.appCrashed")}</p>;
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

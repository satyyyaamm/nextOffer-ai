import "./layout.css";
import "./animations.css";
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isAdminPath } from "./admin/adminSession";
import ErrorBoundary from "./ErrorBoundary";
import { initCrashReporting } from "./crashReporting";
import { initAnalyticsAfterConsent } from "./analytics";

const AdminApp = lazy(() => import("./admin/AdminApp").then((m) => ({ default: m.AdminApp })));

initCrashReporting();
if (!isAdminPath()) {
  initAnalyticsAfterConsent();
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    {isAdminPath() ? (
      <Suspense fallback={<div style={{ minHeight: "100svh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>Loading admin…</div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </ErrorBoundary>
);

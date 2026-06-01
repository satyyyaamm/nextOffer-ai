import "./layout.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import { initCrashReporting } from "./crashReporting";
import { trackAppOpenOnce } from "./analytics";

initCrashReporting();
trackAppOpenOnce();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

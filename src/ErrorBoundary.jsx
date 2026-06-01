import React from "react";
import { C, font } from "./theme";
import { reportError } from "./crashReporting";

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
    reportError(error, { source: "error_boundary", fatal: true });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100svh",
            background: C.bg,
            color: C.text,
            fontFamily: font,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 16,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: C.sub, maxWidth: 320 }}>
            {this.state.error?.message || "The app hit an unexpected error."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              background: C.accent,
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

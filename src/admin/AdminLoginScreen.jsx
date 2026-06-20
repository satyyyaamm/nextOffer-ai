import { useState } from "react";
import { AppBrand, AppLogo } from "../brand";
import { C, cardStyle } from "../theme";
import { adminLogin } from "./adminApi";

const Spinner = ({ size = 20 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `2px solid ${C.border}`,
      borderTopColor: C.accent,
      animation: "spin .8s linear infinite",
    }}
  />
);

export function AdminLoginScreen({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminLogin(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err?.message || "Invalid email or password.");
    }
    setLoading(false);
  };

  return (
    <div className="lp-page">
      <div
        style={{
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left))",
        }}
      >
        <div style={{ ...cardStyle, width: "100%", maxWidth: 400, padding: "28px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <AppLogo size={56} style={{ margin: "0 auto 16px" }} />
            <AppBrand fontSize={24} />
            <p style={{ fontSize: 14, color: C.sub, marginTop: 8, textAlign: "center" }}>
              Admin sign in
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 14,
                  background: C.surface,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 14,
                  background: C.surface,
                }}
              />
            </label>
            {error && (
              <p style={{ margin: 0, fontSize: 13, color: C.red, lineHeight: 1.45 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-premium btn-press"
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 12,
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? <Spinner size={20} color="#fff" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 12, color: C.muted, textAlign: "center" }}>
            <a href="/" style={{ color: C.accent, textDecoration: "none" }}>
              ← Back to NextOffer.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

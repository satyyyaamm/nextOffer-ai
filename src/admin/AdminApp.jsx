import { useCallback, useEffect, useState } from "react";
import { C } from "../theme";
import { GlobalStyle } from "../GlobalStyle";
import { AdminLoginScreen } from "./AdminLoginScreen";
import { AdminPanel } from "./AdminPanel";
import { hasAdminSession } from "./adminApi";
import { getAdminSection, navigateAdminSection } from "./adminSession";

const Spinner = ({ size = 36 }) => (
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

export function AdminApp() {
  const [authenticated, setAuthenticated] = useState(hasAdminSession);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    document.title = "Admin — NextOffer.ai";
    setBooting(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setAuthenticated(true);
    navigateAdminSection(getAdminSection());
  }, []);

  const handleLogout = useCallback(() => {
    setAuthenticated(false);
    window.history.replaceState({}, "", "/admin");
  }, []);

  if (booting) {
    return (
      <>
        <GlobalStyle />
        <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      {!authenticated ? <AdminLoginScreen onSuccess={handleLoginSuccess} /> : <AdminPanel onLogout={handleLogout} />}
    </>
  );
}

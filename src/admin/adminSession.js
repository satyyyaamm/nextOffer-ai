const SESSION_KEY = "nextoffer_admin_session";

export function getAdminSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function setAdminSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAdminSession() {
  setAdminSessionToken("");
}

export function isAdminPath() {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/admin");
}

export function getAdminSection() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/admin(?:\/([^/]+))?$/);
  if (!match) return "overview";
  return match[1] || "overview";
}

export function navigateAdminSection(section) {
  const next = section && section !== "overview" ? `/admin/${section}` : "/admin";
  if (window.location.pathname !== next) {
    window.history.pushState({ adminSection: section }, "", next);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

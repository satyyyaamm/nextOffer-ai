/**
 * Analytics / cookie consent (GDPR-friendly when GA4 measurement ID is configured).
 */
const CONSENT_KEY = "no_analytics_consent";
const CONSENT_EVENT = "no_analytics_consent_change";

export function isAnalyticsConfigured() {
  return Boolean(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID);
}

export function getAnalyticsConsent() {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
    return null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  if (!isAnalyticsConfigured()) return false;
  return getAnalyticsConsent() === "granted";
}

export function setAnalyticsConsent(granted) {
  const value = granted ? "granted" : "denied";
  try {
    localStorage.setItem(CONSENT_KEY, value);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function subscribeAnalyticsConsent(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => listener(e.detail);
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

export function shouldShowConsentBanner() {
  return isAnalyticsConfigured() && getAnalyticsConsent() === null;
}

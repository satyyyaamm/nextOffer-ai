/**
 * Web crash reporting: GA4 exceptions + durable logClientError (Firestore).
 */
import { trackException } from "./analytics";
import { logClientError } from "./callable";

const THROTTLE_MS = 60_000;
const recentSignatures = new Map();

let currentScreen = "";
let initialized = false;

export function setCrashScreen(screen) {
  currentScreen = String(screen || "");
}

function errorSignature(error, source) {
  const msg = error instanceof Error ? error.message : String(error);
  return `${source}:${msg.slice(0, 80)}`;
}

function shouldThrottle(signature) {
  const now = Date.now();
  const last = recentSignatures.get(signature) || 0;
  if (now - last < THROTTLE_MS) return true;
  recentSignatures.set(signature, now);
  return false;
}

function normalizeError(error) {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error(String(error));
}

export async function reportError(error, options = {}) {
  const err = normalizeError(error);
  const {
    source = "unknown",
    screen = currentScreen,
    action = "",
    fatal = false,
  } = options;

  console.error(`[crash] ${source}:`, err);

  await trackException(err, source, fatal);

  const signature = errorSignature(err, source);
  if (shouldThrottle(signature)) return;

  try {
    await logClientError({
      message: err.message.slice(0, 500),
      stack: (err.stack || "").slice(0, 4000),
      source: String(source).slice(0, 64),
      screen: String(screen).slice(0, 64),
      action: String(action).slice(0, 64),
      fatal: Boolean(fatal),
      url: typeof window !== "undefined" ? window.location.pathname : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 256) : "",
    });
  } catch (e) {
    console.warn("logClientError failed:", e);
  }
}

function onWindowError(event) {
  const err = event.error || new Error(event.message || "Unknown error");
  reportError(err, { source: "window_onerror", fatal: true });
}

function onUnhandledRejection(event) {
  const reason = event.reason;
  const err = reason instanceof Error ? reason : new Error(String(reason));
  reportError(err, { source: "unhandledrejection", fatal: true });
}

export function initCrashReporting() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
}

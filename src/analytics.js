/**
 * Firebase Analytics (GA4) — centralized event tracking.
 * No PII: no resume text, job titles, emails, or full stacks in event params.
 */
import { logEvent, setUserId, setUserProperties } from "firebase/analytics";
import { getAnalyticsInstance } from "./firebase";

const DEBUG = process.env.REACT_APP_ANALYTICS_DEBUG === "true";
const MAX_PARAM_LEN = 100;
const MAX_PARAMS = 25;

let analyticsReady = null;

function getReady() {
  if (!analyticsReady) {
    analyticsReady = getAnalyticsInstance();
  }
  return analyticsReady;
}

function sanitizeValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const s = value.replace(/<[^>]*>/g, "").slice(0, MAX_PARAM_LEN);
    return s || undefined;
  }
  return String(value).slice(0, MAX_PARAM_LEN);
}

function sanitizeParams(params) {
  if (!params || typeof params !== "object") return {};
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(params)) {
    if (count >= MAX_PARAMS) break;
    const k = String(key).replace(/[^a-z0-9_]/gi, "_").slice(0, 40);
    const v = sanitizeValue(value);
    if (v !== undefined) {
      out[k] = v;
      count += 1;
    }
  }
  return out;
}

export async function track(eventName, params = {}) {
  const name = String(eventName).slice(0, 40);
  const analytics = await getReady();
  if (!analytics) {
    if (DEBUG) console.debug("[analytics]", name, params);
    return;
  }
  try {
    const payload = sanitizeParams(params);
    logEvent(analytics, name, payload);
    if (DEBUG) console.debug("[analytics]", name, payload);
  } catch (e) {
    console.warn("Analytics track failed:", e);
  }
}

export async function identifyUser(uid, props = {}) {
  const analytics = await getReady();
  if (!analytics || !uid) return;
  try {
    setUserId(analytics, uid);
    const safe = sanitizeParams(props);
    if (Object.keys(safe).length) setUserProperties(analytics, safe);
  } catch (e) {
    console.warn("Analytics identify failed:", e);
  }
}

export async function clearUser() {
  const analytics = await getReady();
  if (!analytics) return;
  try {
    setUserId(analytics, null);
  } catch (e) {
    console.warn("Analytics clearUser failed:", e);
  }
}

export async function trackScreen(screenName) {
  await track("screen_view", {
    firebase_screen: String(screenName).slice(0, 64),
    screen: String(screenName).slice(0, 64),
  });
}

export async function trackException(error, context = "", fatal = false) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  await track("exception", {
    description: message.slice(0, 150),
    fatal: Boolean(fatal),
    context: String(context).slice(0, 64),
  });
}

/** ISO week string for cohort bucketing, e.g. 2026-W22 */
export function signupWeekFromDate(isoOrDate) {
  if (!isoOrDate) return undefined;
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return undefined;
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function matchScoreBucket(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return "unknown";
  if (n >= 75) return "high";
  if (n >= 50) return "mid";
  return "low";
}

export function topMatchBucket(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) return "none";
  const scores = jobs.map((j) => Number(j.matchScore ?? j.match_score)).filter((s) => !Number.isNaN(s));
  if (!scores.length) return "unknown";
  return matchScoreBucket(Math.max(...scores));
}

export function upgradeReasonKey(reason) {
  const r = String(reason || "").toLowerCase();
  if (r.includes("search")) return "search";
  if (r.includes("upload") || r.includes("resume")) return "upload";
  if (r.includes("generation") || r.includes("kit") || r.includes("regenerate")) return "kit";
  return "generic";
}

export function errorCodeFromErr(err) {
  if (!err) return "unknown";
  const code = err.code || err.details;
  if (code) return String(code).slice(0, 64);
  const msg = err.message || "";
  if (/FREE_LIMIT|free tier|free plan/i.test(msg)) return "free_limit";
  if (/timed out/i.test(msg)) return "timeout";
  if (/Failed to fetch|network/i.test(msg)) return "network";
  return "error";
}

/** Once per browser session */
export function trackAppOpenOnce() {
  try {
    const key = "no_app_open_tracked";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track("app_open");
  } catch {
    track("app_open");
  }
}

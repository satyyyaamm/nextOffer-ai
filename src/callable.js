/**
 * Call Cloud Functions with Firebase Auth token.
 * Uses official httpsCallable (best CORS support) + fetch fallback.
 */
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { track, errorCodeFromErr } from "./analytics";

const REGION = "us-central1";
const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID;

async function ensureSignedIn() {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error("Please sign in first.");
    err.code = "functions/unauthenticated";
    throw err;
  }
  await user.getIdToken(true);
  return user;
}

async function callViaFetch(functionName, data) {
  const user = await ensureSignedIn();
  const idToken = await user.getIdToken();

  const response = await fetch(
    `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data }),
    }
  );

  const body = await response.json().catch(() => ({}));

  if (body.error) {
    const err = new Error(body.error.message || "Request failed");
    err.code = `functions/${body.error.status || "internal"}`;
    if (body.error.details) err.details = body.error.details;
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Server error (${response.status}). Check Cloud Run permissions.`);
  }

  return { data: body.result };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

function reportApiFailure(functionName, err) {
  if (functionName === "logClientError") return;
  track("api_call_failure", {
    function_name: String(functionName).slice(0, 40),
    error_code: errorCodeFromErr(err),
  });
}

export async function callFunction(functionName, data = {}, timeoutMs = 25000) {
  await ensureSignedIn();

  try {
    const fn = httpsCallable(functions, functionName);
    return await withTimeout(fn(data), timeoutMs, functionName);
  } catch (err) {
    const msg = err?.message || "";
    if (err?.details) {
      const wrapped = new Error(err.details);
      wrapped.code = err.code;
      wrapped.details = err.details;
      reportApiFailure(functionName, wrapped);
      throw wrapped;
    }
    if (msg.includes("Failed to fetch") || msg.includes("Network Error") || err?.code === "functions/internal") {
      try {
        return await callViaFetch(functionName, data);
      } catch (fetchErr) {
        reportApiFailure(functionName, fetchErr);
        throw fetchErr;
      }
    }
    reportApiFailure(functionName, err);
    throw err;
  }
}

export const logClientError = (data) => callFunction("logClientError", data, 10000);

export const getUserProfile = () => callFunction("getUserProfile");
export const parseResume = (data) => callFunction("parseResume", data);
export const searchJobs = (data) => callFunction("searchJobs", data, 120000);
export const generateDocument = (data) => callFunction("generateDocument", data);
export const getJobKit = (data) => callFunction("getJobKit", data);
export const listJobKits = () => callFunction("listJobKits");
export const createCheckoutSession = (data) => callFunction("createCheckoutSession", data);
export const deleteUserData = (data) => callFunction("deleteUserData", data, 120000);

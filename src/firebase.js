import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { hasAnalyticsConsent, isAnalyticsConfigured } from "./consent";

const required = [
  "REACT_APP_FIREBASE_API_KEY",
  "REACT_APP_FIREBASE_AUTH_DOMAIN",
  "REACT_APP_FIREBASE_PROJECT_ID",
];

function missingKeys() {
  return required.filter((k) => !process.env[k]);
}

const missing = missingKeys();
if (missing.length) {
  const msg = `Missing Firebase env vars: ${missing.join(", ")}. Copy .env.local.example → .env.local and rebuild before deploy.`;
  if (process.env.NODE_ENV === "development") {
    console.warn(msg);
  } else {
    console.error(msg);
  }
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  ...(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID && {
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
  }),
};

const app = initializeApp(firebaseConfig);

let analyticsInstancePromise = null;

/** Clear cached Analytics instance (e.g. after user grants consent). */
export function resetAnalyticsInstance() {
  analyticsInstancePromise = null;
}

/**
 * Returns Analytics instance when measurement ID is set and browser supports it.
 */
export function getAnalyticsInstance() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (!isAnalyticsConfigured() || !hasAnalyticsConsent()) {
    return Promise.resolve(null);
  }
  if (!analyticsInstancePromise) {
    analyticsInstancePromise = isSupported().then((ok) => {
      if (!ok) return null;
      return getAnalytics(app);
    });
  }
  return analyticsInstancePromise;
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export default app;

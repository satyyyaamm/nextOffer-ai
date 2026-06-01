import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { track, errorCodeFromErr } from "./analytics";

let persistenceReady = null;

function ensurePersistence() {
  if (!persistenceReady) {
    persistenceReady = (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        console.warn("Local auth persistence unavailable, using session:", e);
        await setPersistence(auth, browserSessionPersistence);
      }
    })();
  }
  return persistenceReady;
}

/**
 * Call once on app load — must finish before trusting auth state after Google redirect.
 */
export async function bootstrapAuth() {
  await ensurePersistence();
  try {
    return await getRedirectResult(auth);
  } catch (err) {
    if (err?.code === "auth/no-auth-event") return null;
    throw err;
  }
}

/**
 * Popup sign-in works reliably on Firebase Hosting; redirect is fallback only.
 */
export async function signInWithGoogle() {
  await ensurePersistence();
  track("sign_in_start", { method: "google" });
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { mode: "popup", user: result.user };
  } catch (err) {
    const code = err?.code || "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, googleProvider);
      return { mode: "redirect" };
    }
    track("sign_in_failure", { error_code: errorCodeFromErr(err) });
    throw err;
  }
}

export function authErrorMessage(err) {
  if (!err) return null;
  const code = err.code || "";

  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/user-cancelled"
  ) {
    return null;
  }
  if (code === "auth/popup-blocked") {
    return "Sign-in was blocked. Allow popups for this site, or try again in Chrome/Safari.";
  }
  if (code === "auth/unauthorized-domain") {
    return "This site isn’t allowed to sign in yet. In Firebase Console → Authentication → Authorized domains, add nextoffer-ai.web.app";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and try again.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "This email is linked to another sign-in method. Try the other provider.";
  }
  return err.message || "Couldn’t sign in. Please try again.";
}

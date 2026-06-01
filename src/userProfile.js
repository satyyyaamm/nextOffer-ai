/**
 * Load/create user profile in Firestore after Google sign-in.
 * Avoids Cloud Functions on login (fixes "Failed to fetch" / Cloud Run auth issues).
 */
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

function defaultProfile(email, name) {
  const now = Timestamp.now();
  return {
    email: email || "",
    name: name || "User",
    tier: "free",
    searches: { count: 0, lastReset: now },
    resumeUploads: { count: 0, lastReset: now },
    applicationKit: {
      jobId: null,
      kitKey: null,
      resume: false,
      cover_letter: false,
      cold_email: false,
      complete: false,
      lastReset: now,
    },
  };
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

export async function loadOrCreateUserProfile(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, defaultProfile(firebaseUser.email, firebaseUser.displayName));
    }

    const fresh = await getDoc(ref);
    if (!fresh.exists()) {
      throw new Error("Profile document was not created. Check Firestore rules for this project.");
    }
    return serializeValue({ id: firebaseUser.uid, ...fresh.data() });
  } catch (err) {
    const code = err?.code || "";
    if (code === "permission-denied") {
      throw new Error(
        "Firestore blocked saving your profile. Deploy firestore rules and confirm the app uses project " +
          (process.env.REACT_APP_FIREBASE_PROJECT_ID || "nextoffer-ai") +
          "."
      );
    }
    throw err;
  }
}

const crypto = require("crypto");
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { parseAdminEmails } = require("./auth");

const db = admin.firestore();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function validateAdminCredentials(email, password, adminEmailRaw, adminPasswordRaw) {
  const normalized = normalizeEmail(email);
  const allowed = parseAdminEmails(adminEmailRaw);
  if (!allowed.length || !normalized || !password) return false;
  if (!allowed.includes(normalized)) return false;
  return password === String(adminPasswordRaw || "");
}

async function createAdminSession(email) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + SESSION_TTL_MS);
  await db.collection("adminSessions").doc(token).set({
    email: normalizeEmail(email),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  });
  return { sessionToken: token, expiresAt: expiresAt.toDate().toISOString() };
}

async function revokeAdminSession(sessionToken) {
  if (!sessionToken) return;
  await db.collection("adminSessions").doc(String(sessionToken)).delete().catch(() => {});
}

async function requireAdminSession(request, adminEmailsRaw) {
  const sessionToken = request.data?.sessionToken;
  if (sessionToken) {
    const doc = await db.collection("adminSessions").doc(String(sessionToken)).get();
    if (!doc.exists) {
      throw new HttpsError("permission-denied", "Admin session expired. Sign in again.");
    }
    const data = doc.data();
    const expiresMs = data.expiresAt?.toMillis?.() || 0;
    if (expiresMs < Date.now()) {
      await doc.ref.delete().catch(() => {});
      throw new HttpsError("permission-denied", "Admin session expired. Sign in again.");
    }
    return data.email || "admin";
  }

  if (request.auth?.token?.admin === true) {
    return request.auth.token.email || request.auth.uid;
  }

  const email = normalizeEmail(request.auth?.token?.email);
  const allowlist = parseAdminEmails(adminEmailsRaw);
  if (email && allowlist.includes(email)) {
    return email;
  }

  throw new HttpsError("permission-denied", "Admin access only.");
}

function stripSessionToken(data) {
  if (!data || typeof data !== "object") return {};
  const { sessionToken, ...rest } = data;
  return rest;
}

module.exports = {
  validateAdminCredentials,
  createAdminSession,
  revokeAdminSession,
  requireAdminSession,
  stripSessionToken,
};

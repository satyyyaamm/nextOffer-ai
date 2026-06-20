const { HttpsError } = require("firebase-functions/v2/https");

function parseAdminEmails(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminRequest(request, adminEmailsRaw) {
  const email = String(request.auth?.token?.email || "").toLowerCase();
  if (!email) return false;
  const allowlist = parseAdminEmails(adminEmailsRaw);
  return allowlist.length > 0 && allowlist.includes(email);
}

function requireAdmin(request, adminEmailsRaw) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  if (!isAdminRequest(request, adminEmailsRaw)) {
    throw new HttpsError("permission-denied", "Admin access only.");
  }
  return request.auth.uid;
}

module.exports = { parseAdminEmails, isAdminRequest, requireAdmin };

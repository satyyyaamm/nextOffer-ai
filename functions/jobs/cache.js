const admin = require("firebase-admin");
const { CACHE_TTL_MS } = require("./shared");

const COLLECTION = "jobSearchCache";

async function getCachedSearch(db, cacheKey) {
  try {
    const doc = await db.collection(COLLECTION).doc(cacheKey).get();
    if (!doc.exists) return null;
    const data = doc.data();
    const expiresAt = data.expiresAt?.toDate?.() || new Date(0);
    if (Date.now() > expiresAt.getTime()) {
      await doc.ref.delete().catch(() => {});
      return null;
    }
    return data.payload || null;
  } catch (err) {
    console.warn("Cache read failed:", err.message);
    return null;
  }
}

async function setCachedSearch(db, cacheKey, payload, userId) {
  try {
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + CACHE_TTL_MS));
    await db.collection(COLLECTION).doc(cacheKey).set({
      userId,
      payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });
  } catch (err) {
    console.warn("Cache write failed:", err.message);
  }
}

module.exports = { getCachedSearch, setCachedSearch };

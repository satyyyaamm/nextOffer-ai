const admin = require("firebase-admin");
const { dayKey, monthKey } = require("./aiLogger");

const db = admin.firestore();

/**
 * Log one RapidAPI JSearch HTTP request (each call to /search = 1 credit).
 * @param {string} userId
 * @param {{ kind?: string, paginateOnly?: boolean }} meta
 */
async function logJSearchUsage(userId, meta = {}) {
  const day = dayKey();
  const month = monthKey();
  const kind = String(meta.kind || "search").slice(0, 32);

  const dailyRef = db.collection("adminMetrics").doc("jsearch").collection("daily").doc(day);
  const monthlyRef = db.collection("adminMetrics").doc("jsearch").collection("monthly").doc(month);

  await db.runTransaction(async (tx) => {
    const dailySnap = await tx.get(dailyRef);
    const daily = dailySnap.data() || { date: day, totalRequests: 0, byKind: {} };
    daily.totalRequests = (daily.totalRequests || 0) + 1;
    daily.byKind = daily.byKind || {};
    daily.byKind[kind] = (daily.byKind[kind] || 0) + 1;
    daily.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    tx.set(dailyRef, daily, { merge: true });

    const monthlySnap = await tx.get(monthlyRef);
    const monthly = monthlySnap.data() || { month, totalRequests: 0, byKind: {} };
    monthly.totalRequests = (monthly.totalRequests || 0) + 1;
    monthly.byKind = monthly.byKind || {};
    monthly.byKind[kind] = (monthly.byKind[kind] || 0) + 1;
    monthly.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    tx.set(monthlyRef, monthly, { merge: true });
  });

  if (userId) {
    await db
      .collection("adminMetrics")
      .doc("jsearch")
      .collection("byUser")
      .doc(String(userId))
      .set(
        {
          userId: String(userId),
          totalRequests: admin.firestore.FieldValue.increment(1),
          lastKind: kind,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});
  }
}

module.exports = { logJSearchUsage };

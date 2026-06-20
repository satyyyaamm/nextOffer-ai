const admin = require("firebase-admin");
const { dayKey } = require("./aiLogger");

const db = admin.firestore();

async function safeCount(query) {
  try {
    const snap = await query.count().get();
    return snap.data().count || 0;
  } catch (err) {
    console.warn("Count query failed:", err.message);
    return null;
  }
}

function tsToIso(value) {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  return null;
}

async function fetchAiSpendSeries(days = 30) {
  const series = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    const doc = await db.collection("adminMetrics").doc("ai").collection("daily").doc(key).get();
    const data = doc.data() || {};
    series.push({
      date: key,
      calls: data.totalCalls || 0,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      estimatedUsd: Number((data.estimatedUsd || 0).toFixed(4)),
    });
  }
  return series;
}

async function fetchCurrentMonthAi() {
  const month = new Date().toISOString().slice(0, 7);
  const doc = await db.collection("adminMetrics").doc("ai").collection("monthly").doc(month).get();
  const data = doc.data() || {};
  return {
    month,
    totalCalls: data.totalCalls || 0,
    inputTokens: data.inputTokens || 0,
    outputTokens: data.outputTokens || 0,
    estimatedUsd: Number((data.estimatedUsd || 0).toFixed(4)),
    byAction: data.byAction || {},
  };
}

async function scanUserMetrics() {
  const snap = await db.collection("users").get();
  const now = Date.now();
  const d7 = now - 7 * 86400000;
  const d30 = now - 30 * 86400000;

  const stats = {
    totalUsers: 0,
    proUsers: 0,
    freeUsers: 0,
    withResume: 0,
    withSearchThisMonth: 0,
    withUploadThisMonth: 0,
    withKitThisMonth: 0,
    withLinkedInThisMonth: 0,
    newUsers7d: 0,
    newUsers30d: 0,
    checkoutStarted: 0,
    checkoutCompleted: 0,
    checkoutAbandoned: 0,
    checkoutFailed: 0,
    proWeekly: 0,
    proMonthly: 0,
    hitFreeSearchLimit: 0,
    hitFreeUploadLimit: 0,
    hitFreeKitLimit: 0,
    hitFreeLinkedInLimit: 0,
  };

  for (const doc of snap.docs) {
    const u = doc.data();
    stats.totalUsers += 1;

    if (u.tier === "pro") {
      stats.proUsers += 1;
      if (u.proPlan === "weekly") stats.proWeekly += 1;
      else stats.proMonthly += 1;
    } else {
      stats.freeUsers += 1;
    }

    if (u.parsedProfile?.title) stats.withResume += 1;

    const created = u.createdAt?.toDate?.()?.getTime?.() || 0;
    if (created >= d7) stats.newUsers7d += 1;
    if (created >= d30) stats.newUsers30d += 1;

    if ((u.searches?.count || 0) >= 1) stats.withSearchThisMonth += 1;
    if ((u.resumeUploads?.count || 0) >= 1) stats.withUploadThisMonth += 1;
    const kit = u.applicationKit || {};
    if (kit.resume || kit.cover_letter || kit.cold_email) stats.withKitThisMonth += 1;
    if ((u.linkedinAnalysis?.count || 0) >= 1) stats.withLinkedInThisMonth += 1;

    const billing = u.billing || {};
    const attempts = Number(billing.checkoutAttempts) || 0;
    const status = billing.lastCheckoutStatus || null;

    if (attempts > 0 || status) {
      stats.checkoutStarted += 1;
    }
    if (u.tier === "pro" && u.upgradedAt) {
      stats.checkoutCompleted += 1;
    }
    if (status === "dismissed" && u.tier !== "pro") {
      stats.checkoutAbandoned += 1;
    }
    if (status === "failed" && u.tier !== "pro") {
      stats.checkoutFailed += 1;
    }

    if (u.tier !== "pro") {
      if ((u.searches?.count || 0) >= 1) stats.hitFreeSearchLimit += 1;
      if ((u.resumeUploads?.count || 0) >= 1) stats.hitFreeUploadLimit += 1;
      if (kit.resume || kit.cover_letter || kit.cold_email) stats.hitFreeKitLimit += 1;
      if ((u.linkedinAnalysis?.count || 0) >= 1) stats.hitFreeLinkedInLimit += 1;
    }
  }

  stats.checkoutStartedNotPro = snap.docs.filter((doc) => {
    const u = doc.data();
    const billing = u.billing || {};
    const started = (Number(billing.checkoutAttempts) || 0) > 0 || billing.lastCheckoutStatus;
    return started && u.tier !== "pro";
  }).length;

  return stats;
}

async function fetchRecentErrors(limit = 20) {
  const snap = await db
    .collection("clientErrors")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
    .catch(() => null);

  if (!snap) return [];

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      uid: d.uid || "",
      message: String(d.message || "").slice(0, 200),
      screen: d.screen || "",
      action: d.action || "",
      fatal: Boolean(d.fatal),
      createdAt: tsToIso(d.createdAt),
    };
  });
}

async function fetchActivityCounts() {
  const [documents, jobKits, linkedinAnalyses, searchHistory, clientErrors7d] = await Promise.all([
    safeCount(db.collectionGroup("documents")),
    safeCount(db.collectionGroup("jobKits")),
    safeCount(db.collectionGroup("linkedinAnalyses")),
    safeCount(db.collectionGroup("history")),
    safeCount(
      db
        .collection("clientErrors")
        .where("createdAt", ">", admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 86400000))
    ),
  ]);

  return {
    totalDocumentsGenerated: documents,
    totalJobKitsSaved: jobKits,
    totalLinkedInAnalyses: linkedinAnalyses,
    totalSearchRuns: searchHistory,
    clientErrorsLast7d: clientErrors7d,
  };
}

async function listUsers({ limit = 50, startAfterId = null } = {}) {
  let query = db.collection("users").orderBy("createdAt", "desc").limit(Math.min(limit, 100));
  if (startAfterId) {
    const cursor = await db.collection("users").doc(startAfterId).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snap = await query.get();

  const users = snap.docs.map((doc) => {
    const u = doc.data();
    const kit = u.applicationKit || {};
    const billing = u.billing || {};
    return {
      id: doc.id,
      email: u.email || "",
      name: u.name || "",
      tier: u.tier || "free",
      proPlan: u.proPlan || null,
      createdAt: tsToIso(u.createdAt),
      upgradedAt: tsToIso(u.upgradedAt),
      hasResume: Boolean(u.parsedProfile?.title),
      searchesThisMonth: u.searches?.count || 0,
      uploadsThisMonth: u.resumeUploads?.count || 0,
      linkedinThisMonth: u.linkedinAnalysis?.count || 0,
      kitUsedThisMonth: Boolean(kit.resume || kit.cover_letter || kit.cold_email),
      checkoutStatus: billing.lastCheckoutStatus || null,
      checkoutAttempts: billing.checkoutAttempts || 0,
      lastCheckoutAt: tsToIso(billing.lastCheckoutAt),
      lastCheckoutPlan: billing.lastCheckoutPlan || null,
    };
  });

  return {
    users,
    nextPageId: users.length ? users[users.length - 1].id : null,
    hasMore: users.length >= limit,
  };
}

async function buildAdminDashboard() {
  const [userStats, activityCounts, aiMonth, aiSeries, recentErrors] = await Promise.all([
    scanUserMetrics(),
    fetchActivityCounts(),
    fetchCurrentMonthAi(),
    fetchAiSpendSeries(30),
    fetchRecentErrors(15),
  ]);

  const aiSeriesTotal = aiSeries.reduce((sum, d) => sum + (d.estimatedUsd || 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    users: userStats,
    activity: activityCounts,
    checkoutFunnel: {
      started: userStats.checkoutStarted,
      completed: userStats.checkoutCompleted,
      abandoned: userStats.checkoutAbandoned,
      failed: userStats.checkoutFailed,
      startedNotConverted: userStats.checkoutStartedNotPro,
      conversionRate:
        userStats.checkoutStarted > 0
          ? Number(((userStats.checkoutCompleted / userStats.checkoutStarted) * 100).toFixed(1))
          : 0,
    },
    ai: {
      currentMonth: aiMonth,
      last30DaysUsd: Number(aiSeriesTotal.toFixed(4)),
      dailySeries: aiSeries,
      pricingNote: "Claude Haiku 4.5 @ $1/M input, $5/M output (estimated from logged token usage)",
    },
    freeTierUsage: {
      usedSearch: userStats.hitFreeSearchLimit,
      usedUpload: userStats.hitFreeUploadLimit,
      usedKit: userStats.hitFreeKitLimit,
      usedLinkedIn: userStats.hitFreeLinkedInLimit,
    },
    recentErrors,
  };
}

module.exports = {
  buildAdminDashboard,
  listUsers,
  fetchRecentErrors,
};

const admin = require("firebase-admin");
const { estimateAiCostUsd } = require("./constants");

const db = admin.firestore();

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function logAiUsage(userId, action, usage) {
  const inputTokens = Number(usage?.input_tokens) || 0;
  const outputTokens = Number(usage?.output_tokens) || 0;
  if (!inputTokens && !outputTokens) return;

  const costUsd = estimateAiCostUsd(inputTokens, outputTokens);
  const day = dayKey();
  const month = monthKey();
  const safeAction = String(action || "other").slice(0, 40);

  const dailyRef = db.collection("adminMetrics").doc("ai").collection("daily").doc(day);
  const monthlyRef = db.collection("adminMetrics").doc("ai").collection("monthly").doc(month);

  await db.runTransaction(async (tx) => {
    const dailySnap = await tx.get(dailyRef);
    const daily = dailySnap.data() || {
      date: day,
      totalCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedUsd: 0,
      byAction: {},
    };

    daily.totalCalls += 1;
    daily.inputTokens += inputTokens;
    daily.outputTokens += outputTokens;
    daily.estimatedUsd = Number((daily.estimatedUsd + costUsd).toFixed(6));
    daily.byAction = daily.byAction || {};
    const actionStats = daily.byAction[safeAction] || { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 };
    actionStats.calls += 1;
    actionStats.inputTokens += inputTokens;
    actionStats.outputTokens += outputTokens;
    actionStats.estimatedUsd = Number((actionStats.estimatedUsd + costUsd).toFixed(6));
    daily.byAction[safeAction] = actionStats;
    daily.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    tx.set(dailyRef, daily, { merge: true });

    const monthlySnap = await tx.get(monthlyRef);
    const monthly = monthlySnap.data() || {
      month,
      totalCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedUsd: 0,
      byAction: {},
    };
    monthly.totalCalls += 1;
    monthly.inputTokens += inputTokens;
    monthly.outputTokens += outputTokens;
    monthly.estimatedUsd = Number((monthly.estimatedUsd + costUsd).toFixed(6));
    monthly.byAction = monthly.byAction || {};
    const monthAction = monthly.byAction[safeAction] || { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 };
    monthAction.calls += 1;
    monthAction.inputTokens += inputTokens;
    monthAction.outputTokens += outputTokens;
    monthAction.estimatedUsd = Number((monthAction.estimatedUsd + costUsd).toFixed(6));
    monthly.byAction[safeAction] = monthAction;
    monthly.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    tx.set(monthlyRef, monthly, { merge: true });
  });

  if (userId) {
    await db
      .collection("adminMetrics")
      .doc("ai")
      .collection("byUser")
      .doc(String(userId))
      .set(
        {
          userId: String(userId),
          totalCalls: admin.firestore.FieldValue.increment(1),
          inputTokens: admin.firestore.FieldValue.increment(inputTokens),
          outputTokens: admin.firestore.FieldValue.increment(outputTokens),
          estimatedUsd: admin.firestore.FieldValue.increment(costUsd),
          lastAction: safeAction,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});
  }
}

module.exports = { logAiUsage, dayKey, monthKey };

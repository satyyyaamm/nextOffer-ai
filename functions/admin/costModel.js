/** Shared infra cost assumptions — keep in sync with src/admin/costModel.js */

const AI_COST = {
  freeUserMaxMonthly: 0.035,
  proModerateMonthly: 0.5,
  proHeavyBaseMonthly: 0.35,
  aiPerProSearch: 0.018,
};

const JSEARCH = {
  avgRequestsPerSearch: 2,
  cacheHitRate: 0.35,
};

const JSEARCH_PLANS = [
  { id: "basic", label: "Basic (RapidAPI)", monthlyUsd: 0, included: 200, overageUsd: null },
  { id: "pro", label: "Pro", monthlyUsd: 25, included: 10000, overageUsd: 0.003 },
  { id: "ultra", label: "Ultra", monthlyUsd: 75, included: 50000, overageUsd: 0.002 },
  { id: "mega", label: "Mega", monthlyUsd: 150, included: 200000, overageUsd: 0.001 },
];

const FIREBASE = {
  baseMonthlyUsd: 0,
  perUserMonthlyUsd: 0,
};

const REVENUE = {
  proNetMonthlyUsd: 9.65,
};

function effectiveRequestsPerSearch() {
  return JSEARCH.avgRequestsPerSearch * (1 - JSEARCH.cacheHitRate);
}

function pickJSearchPlan(totalRequests) {
  let best = { plan: JSEARCH_PLANS[0], totalUsd: Infinity };

  for (const plan of JSEARCH_PLANS) {
    let totalUsd = plan.monthlyUsd;
    if (totalRequests > plan.included) {
      if (plan.overageUsd == null) {
        totalUsd = Infinity;
      } else {
        totalUsd += (totalRequests - plan.included) * plan.overageUsd;
      }
    }
    if (totalUsd < best.totalUsd) {
      best = { plan, totalUsd, overageRequests: Math.max(0, totalRequests - plan.included) };
    }
  }

  return best;
}

/**
 * @param {object} params
 * @param {number} params.totalUsers
 * @param {number} params.proPercent — 0–100
 * @param {number} params.proHeavyPercent — share of Pro users on heavy daily use, 0–100
 * @param {number} params.proSearchesPerDay — for heavy Pro users
 * @param {number} params.freeActivePercent — share of free users maxing monthly limits
 * @param {number} [params.proModerateSearchesPerMonth]
 */
function projectMonthlyCosts({
  totalUsers,
  proPercent,
  proHeavyPercent,
  proSearchesPerDay,
  freeActivePercent,
  proModerateSearchesPerMonth = 10,
}) {
  const users = Math.max(0, Number(totalUsers) || 0);
  const proPct = Math.min(100, Math.max(0, Number(proPercent) || 0));
  const heavyPct = Math.min(100, Math.max(0, Number(proHeavyPercent) || 0));
  const searchesDay = Math.min(50, Math.max(0, Number(proSearchesPerDay) || 0));
  const freeActivePct = Math.min(100, Math.max(0, Number(freeActivePercent) || 0));

  const proUsers = users * (proPct / 100);
  const freeUsers = users - proUsers;
  const proHeavy = proUsers * (heavyPct / 100);
  const proModerate = proUsers - proHeavy;
  const freeActive = freeUsers * (freeActivePct / 100);

  const reqPerSearch = effectiveRequestsPerSearch();

  const freeJsearch = freeActive * 1 * reqPerSearch;
  const moderateJsearch = proModerate * proModerateSearchesPerMonth * reqPerSearch;
  const heavyJsearch = proHeavy * searchesDay * 30 * reqPerSearch;
  const totalJsearchRequests = Math.round(freeJsearch + moderateJsearch + heavyJsearch);

  const freeAi = freeActive * AI_COST.freeUserMaxMonthly;
  const moderateAi = proModerate * AI_COST.proModerateMonthly;
  const heavyAi =
    proHeavy * (AI_COST.proHeavyBaseMonthly + searchesDay * 30 * AI_COST.aiPerProSearch);
  const totalAi = freeAi + moderateAi + heavyAi;

  const jsearchPlan = pickJSearchPlan(totalJsearchRequests);
  const firebase = FIREBASE.baseMonthlyUsd + users * FIREBASE.perUserMonthlyUsd;
  const totalCost = totalAi + jsearchPlan.totalUsd + firebase;
  const revenue = proUsers * REVENUE.proNetMonthlyUsd;
  const net = revenue - totalCost;

  return {
    inputs: {
      totalUsers: users,
      proPercent: proPct,
      proHeavyPercent: heavyPct,
      proSearchesPerDay: searchesDay,
      freeActivePercent: freeActivePct,
      proModerateSearchesPerMonth,
    },
    breakdown: {
      users: { total: users, pro: Number(proUsers.toFixed(1)), free: Number(freeUsers.toFixed(1)) },
      aiUsd: Number(totalAi.toFixed(2)),
      aiDetail: {
        free: Number(freeAi.toFixed(2)),
        proModerate: Number(moderateAi.toFixed(2)),
        proHeavy: Number(heavyAi.toFixed(2)),
      },
      jsearchRequests: totalJsearchRequests,
      jsearchUsd: Number((jsearchPlan.totalUsd === Infinity ? 0 : jsearchPlan.totalUsd).toFixed(2)),
      jsearchPlan: jsearchPlan.plan.label,
      jsearchOverage: jsearchPlan.overageRequests || 0,
      jsearchOverQuota: jsearchPlan.totalUsd === Infinity,
      firebaseUsd: Number(firebase.toFixed(2)),
      totalCostUsd: Number((jsearchPlan.totalUsd === Infinity ? totalAi + firebase : totalCost).toFixed(2)),
      revenueUsd: Number(revenue.toFixed(2)),
      netUsd: Number((jsearchPlan.totalUsd === Infinity ? revenue - totalAi - firebase : net).toFixed(2)),
      marginPercent:
        revenue > 0
          ? Number(
              (
                ((jsearchPlan.totalUsd === Infinity ? revenue - totalAi - firebase : net) / revenue) *
                100
              ).toFixed(1)
            )
          : 0,
    },
    assumptions: {
      aiFreeMax: AI_COST.freeUserMaxMonthly,
      aiProModerate: AI_COST.proModerateMonthly,
      jsearchPerSearch: JSEARCH.avgRequestsPerSearch,
      cacheHitRate: JSEARCH.cacheHitRate,
      proNetRevenue: REVENUE.proNetMonthlyUsd,
    },
  };
}

module.exports = {
  AI_COST,
  JSEARCH,
  JSEARCH_PLANS,
  FIREBASE,
  REVENUE,
  effectiveRequestsPerSearch,
  pickJSearchPlan,
  projectMonthlyCosts,
};

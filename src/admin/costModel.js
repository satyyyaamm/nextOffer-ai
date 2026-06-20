/** Client-side cost model — keep in sync with functions/admin/costModel.js */

export const AI_COST = {
  freeUserMaxMonthly: 0.035,
  proModerateMonthly: 0.5,
  proHeavyBaseMonthly: 0.35,
  aiPerProSearch: 0.018,
};

export const JSEARCH = {
  avgRequestsPerSearch: 2,
  cacheHitRate: 0.35,
};

export const JSEARCH_PLANS = [
  { id: "basic", label: "Basic (RapidAPI)", monthlyUsd: 0, included: 200, overageUsd: null },
  { id: "pro", label: "Pro", monthlyUsd: 25, included: 10000, overageUsd: 0.003 },
  { id: "ultra", label: "Ultra", monthlyUsd: 75, included: 50000, overageUsd: 0.002 },
  { id: "mega", label: "Mega", monthlyUsd: 150, included: 200000, overageUsd: 0.001 },
];

export const FIREBASE = {
  baseMonthlyUsd: 0,
  perUserMonthlyUsd: 0,
};

export const REVENUE = {
  proNetMonthlyUsd: 9.65,
};

function effectiveRequestsPerSearch() {
  return JSEARCH.avgRequestsPerSearch * (1 - JSEARCH.cacheHitRate);
}

export function pickJSearchPlan(totalRequests) {
  let best = { plan: JSEARCH_PLANS[0], totalUsd: Infinity, overageRequests: 0 };

  for (const plan of JSEARCH_PLANS) {
    let totalUsd = plan.monthlyUsd;
    let overageRequests = 0;
    if (totalRequests > plan.included) {
      if (plan.overageUsd == null) {
        totalUsd = Infinity;
      } else {
        overageRequests = totalRequests - plan.included;
        totalUsd += overageRequests * plan.overageUsd;
      }
    }
    if (totalUsd < best.totalUsd) {
      best = { plan, totalUsd, overageRequests };
    }
  }

  return best;
}

export function projectMonthlyCosts({
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
  const jsearchUsd = jsearchPlan.totalUsd === Infinity ? null : jsearchPlan.totalUsd;
  const totalCost = jsearchUsd == null ? null : totalAi + jsearchUsd + firebase;
  const revenue = proUsers * REVENUE.proNetMonthlyUsd;
  const net = totalCost == null ? null : revenue - totalCost;

  return {
    proUsers,
    freeUsers,
    totalJsearchRequests,
    aiUsd: totalAi,
    aiDetail: { free: freeAi, proModerate: moderateAi, proHeavy: heavyAi },
    jsearchUsd,
    jsearchPlan: jsearchPlan.plan,
    jsearchOverage: jsearchPlan.overageRequests,
    jsearchOverQuota: jsearchPlan.totalUsd === Infinity,
    firebaseUsd: firebase,
    totalCostUsd: totalCost,
    revenueUsd: revenue,
    netUsd: net,
    marginPercent: revenue > 0 && net != null ? (net / revenue) * 100 : 0,
  };
}

export function defaultsFromDashboard(dashboard) {
  const u = dashboard?.users || {};
  const total = u.totalUsers || 100;
  const proPct = total > 0 ? Math.round(((u.proUsers || 0) / total) * 100) : 5;
  const jsearch = dashboard?.jsearch?.currentMonth?.totalRequests || 0;
  const searchesLogged = dashboard?.jsearch?.searchesEstimated || 0;

  return {
    totalUsers: total || 100,
    proPercent: Math.max(proPct, 1),
    proHeavyPercent: 20,
    proSearchesPerDay: 3,
    freeActivePercent: 70,
    actualJsearchRequests: jsearch,
    actualAiUsd: dashboard?.ai?.currentMonth?.estimatedUsd || 0,
    actualSearchesEstimated: searchesLogged,
  };
}

const {
  normalizeCompanyKey,
  normalizeTitleKey,
  titleSimilarity,
  getPostedTimestamp,
} = require("./shared");

function normalizeApplyUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return String(url || "").trim().toLowerCase();
  }
}

function dedupeJobs(jobs) {
  const kept = [];

  for (const job of jobs) {
    const companyKey = normalizeCompanyKey(job.company);
    const titleKey = normalizeTitleKey(job.title);
    const applyKey = normalizeApplyUrl(job.apply_url);

    let duplicateIndex = -1;
    for (let i = 0; i < kept.length; i += 1) {
      const existing = kept[i];
      const sameCompanyTitle =
        companyKey &&
        titleKey &&
        normalizeCompanyKey(existing.company) === companyKey &&
        normalizeTitleKey(existing.title) === titleKey;

      const sameApply = applyKey && normalizeApplyUrl(existing.apply_url) === applyKey;

      const similarTitle =
        companyKey &&
        normalizeCompanyKey(existing.company) === companyKey &&
        titleSimilarity(existing.title, job.title) >= 0.9;

      if (sameCompanyTitle || sameApply || similarTitle) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex === -1) {
      kept.push(job);
      continue;
    }

    const existing = kept[duplicateIndex];
    if (getPostedTimestamp(job.posted_at) >= getPostedTimestamp(existing.posted_at)) {
      kept[duplicateIndex] = job;
    }
  }

  return kept;
}

module.exports = { dedupeJobs };

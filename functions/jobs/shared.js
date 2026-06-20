const crypto = require("crypto");

const REGION_MAP = {
  "United States": { country: "us", language: "en", currency: "USD", symbol: "$", adzuna: "us" },
  India: { country: "in", language: "en", currency: "INR", symbol: "₹", adzuna: "in" },
  "United Kingdom": { country: "uk", language: "en", currency: "GBP", symbol: "£", adzuna: "gb" },
  Canada: { country: "ca", language: "en", currency: "CAD", symbol: "C$", adzuna: "ca" },
  Australia: { country: "au", language: "en", currency: "AUD", symbol: "A$", adzuna: "au" },
  Germany: { country: "de", language: "de", currency: "EUR", symbol: "€", adzuna: "de" },
};

const CACHE_TTL_MS = 30 * 60 * 1000;

function normalizeFilterList(value, fallback) {
  if (Array.isArray(value) && value.length > 0) return value;
  if (typeof value === "string" && value) return [value];
  return fallback;
}

function cleanJobTitle(title) {
  if (!title) return "software engineer";
  let t = String(title).trim();
  t = t.split(/[|•/–—>]/)[0].trim();
  t = t.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return t || "software engineer";
}

function buildSearchQueryVariants(profile) {
  const title = cleanJobTitle(profile.title || profile.job_titles?.[0]);
  const words = title.split(/\s+/).filter((w) => w.length > 1);
  const variants = [];

  const add = (q) => {
    const s = String(q || "").trim().slice(0, 80);
    if (s && !variants.includes(s)) variants.push(s);
  };

  add(words.slice(0, 4).join(" "));
  if (words.length > 2) add(words.slice(0, 3).join(" "));
  if (words.length > 1) add(words.slice(0, 2).join(" "));

  for (const alt of profile.job_titles || []) {
    add(cleanJobTitle(alt));
  }

  const skills = [...(profile.skills || []), ...(profile.technologies || []), ...(profile.frameworks || [])];
  for (const skill of skills.slice(0, 3)) {
    if (!skill) continue;
    const sk = String(skill).trim();
    if (!title.toLowerCase().includes(sk.toLowerCase())) {
      add(`${sk} developer`);
    }
  }

  return variants.slice(0, 4);
}

function buildPrimaryQuery(profile) {
  const variants = buildSearchQueryVariants(profile);
  return variants[0] || cleanJobTitle(profile.title);
}

function formatPosted(isoDate) {
  if (!isoDate) return "Recently";
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getPostedTimestamp(isoDate) {
  if (!isoDate) return 0;
  const t = new Date(isoDate).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function normalizeTitleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyKey(company) {
  return String(company || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function titleSimilarity(a, b) {
  const na = normalizeTitleKey(a);
  const nb = normalizeTitleKey(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection += 1;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

function buildCacheKey(userId, profile, filters) {
  const payload = {
    userId,
    title: profile.title,
    skills: (profile.skills || []).slice(0, 25).sort(),
    filters: {
      workplace: filters.workplace,
      salary: filters.salary,
      jobType: filters.jobType,
      datePosted: filters.datePosted,
      region: filters.region?.label,
      cities: [...(filters.cities || [])].sort(),
      sources: [...(filters.sources || [])].sort(),
      experienceLevel: filters.experienceLevel,
    },
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function inferWorkplaceFromText(text, fallback = "On-site") {
  const t = String(text || "").toLowerCase();
  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(t)) return "Remote";
  if (/\bhybrid\b/.test(t)) return "Hybrid";
  if (/\bon-?site\b|\bonsite\b/.test(t)) return "On-site";
  return fallback;
}

function getRegion(filters) {
  return REGION_MAP[filters.region?.label] || REGION_MAP["United States"];
}

module.exports = {
  REGION_MAP,
  CACHE_TTL_MS,
  normalizeFilterList,
  cleanJobTitle,
  buildSearchQueryVariants,
  buildPrimaryQuery,
  formatPosted,
  getPostedTimestamp,
  normalizeTitleKey,
  normalizeCompanyKey,
  titleSimilarity,
  buildCacheKey,
  inferWorkplaceFromText,
  getRegion,
};

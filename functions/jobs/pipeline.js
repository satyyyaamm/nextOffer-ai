const { buildCacheKey, getRegion } = require("./shared");
const { dedupeJobs } = require("./dedupe");
const {
  scoreJobsForProfile,
  applyExperienceLevelFilter,
  applySourceFilter,
  applyRemoteOnlyFilter,
} = require("./matchScore");
const { rankJobs } = require("./rank");
const { getCachedSearch, setCachedSearch } = require("./cache");
const { fetchJoobleJobs } = require("./jooble");
const { fetchAdzunaJobs } = require("./adzuna");

function tagJSearchJobs(jobs) {
  return jobs.map((job) => ({
    ...job,
    provider: job.provider || "jsearch",
  }));
}

/**
 * Multi-source search pipeline.
 * @param {object} params
 * @param {object} params.profile
 * @param {object} params.filters
 * @param {string} params.userId
 * @param {FirebaseFirestore.Firestore} params.db
 * @param {Function} params.fetchJSearchJobs - existing JSearch fetch from index.js
 * @param {object} params.keys - { rapidApiKey, joobleApiKey, adzunaAppId, adzunaAppKey }
 * @param {object} params.options - JSearch fetch options
 */
async function runMultiSourceSearch({
  profile,
  filters,
  userId,
  db,
  fetchJSearchJobs,
  keys,
  options = {},
}) {
  const region = getRegion(filters);
  const cacheKey = buildCacheKey(userId, profile, filters);

  const cached = await getCachedSearch(db, cacheKey);
  if (cached) {
    console.log(`Search cache hit: ${cacheKey.slice(0, 12)}…`);
    return { ...cached, fromCache: true };
  }

  const [jsearchResult, joobleJobs, adzunaJobs] = await Promise.all([
    fetchJSearchJobs(profile, filters, keys.rapidApiKey, options),
    fetchJoobleJobs(profile, filters, keys.joobleApiKey, region).catch(() => []),
    fetchAdzunaJobs(profile, filters, keys.adzunaAppId, keys.adzunaAppKey, region).catch(() => []),
  ]);

  const jsearchJobs = tagJSearchJobs(jsearchResult.jobs || []);
  const combined = [...jsearchJobs, ...joobleJobs, ...adzunaJobs];

  let jobs = dedupeJobs(combined);
  jobs = applySourceFilter(jobs, filters.sources);
  jobs = applyExperienceLevelFilter(jobs, filters.experienceLevel);
  jobs = applyRemoteOnlyFilter(jobs, filters);
  jobs = scoreJobsForProfile(jobs, profile, filters);
  jobs = rankJobs(jobs);

  const searchStats = {
    rawCount: combined.length,
    afterDedupe: jobs.length,
    byProvider: {
      jsearch: jsearchJobs.length,
      jooble: joobleJobs.length,
      adzuna: adzunaJobs.length,
    },
    queries: jsearchResult.jsearchStats?.queries || [],
    jsearchRaw: jsearchResult.jsearchStats?.rawCount || jsearchJobs.length,
    afterFilters: jobs.length,
  };

  const payload = {
    jobs,
    region: jsearchResult.region || region,
    query: jsearchResult.query,
    hasMoreApi: jsearchResult.hasMoreApi,
    apiPage: jsearchResult.apiPage,
    datePostedEffective: jsearchResult.datePostedEffective,
    datePostedNotice: jsearchResult.datePostedNotice,
    searchStats,
    jsearchStats: jsearchResult.jsearchStats,
  };

  if (jobs.length > 0) {
    await setCachedSearch(db, cacheKey, payload, userId);
  }

  return payload;
}

module.exports = { runMultiSourceSearch };

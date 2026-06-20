const {
  buildPrimaryQuery,
  formatPosted,
  inferWorkplaceFromText,
  getRegion,
} = require("./shared");

function mapAdzunaJob(item, index, region) {
  const title = item.title || "Untitled Role";
  const company = item.company?.display_name || item.company || "Unknown Company";
  const location = item.location?.display_name || item.location || "Not specified";
  const description = item.description || "";
  const workplace = inferWorkplaceFromText(`${title} ${location} ${description}`);

  let salaryMin = 0;
  let salaryMax = 0;
  if (item.salary_min || item.salary_max) {
    if (region.currency === "INR") {
      salaryMin = Math.round((item.salary_min || 0) / 100000);
      salaryMax = Math.round((item.salary_max || item.salary_min || 0) / 100000);
    } else {
      salaryMin = Math.round((item.salary_min || 0) / 1000);
      salaryMax = Math.round((item.salary_max || item.salary_min || 0) / 1000);
    }
  }

  const postedAt = item.created ? new Date(item.created).toISOString() : null;

  return {
    id: item.id ? `adzuna-${item.id}` : `adzuna-${index}`,
    title,
    company,
    location,
    workplace,
    employment_type: item.contract_type || "",
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_unit: region.currency === "INR" ? "lpa" : "k",
    source: "Adzuna",
    provider: "adzuna",
    posted: formatPosted(postedAt),
    posted_at: postedAt,
    match_score: 0,
    apply_url: item.redirect_url || item.url || "",
    description,
    tags: [],
    logo_initials: String(company).slice(0, 2).toUpperCase(),
    employer_logo: null,
    api: item,
  };
}

async function fetchAdzunaJobs(profile, filters, appId, appKey, region) {
  if (!appId || !appKey) return [];

  const country = region.adzuna || "us";
  const what = buildPrimaryQuery(profile);
  const cities = Array.isArray(filters.cities) ? filters.cities.filter(Boolean) : [];
  const where = cities.length ? cities.join(", ") : filters.region?.label || "";

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("what", what);
  url.searchParams.set("where", where);
  url.searchParams.set("results_per_page", "50");
  url.searchParams.set("content-type", "application/json");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.warn("Adzuna error:", response.status, await response.text());
      return [];
    }
    const data = await response.json();
    const results = data.results || [];
    console.log(`Adzuna "${what}" @ ${where}: ${results.length} jobs`);
    return results.map((item, index) => mapAdzunaJob(item, index, region));
  } catch (err) {
    console.warn("Adzuna fetch failed:", err.message);
    return [];
  }
}

module.exports = { fetchAdzunaJobs, mapAdzunaJob, getRegion };

const {
  buildPrimaryQuery,
  formatPosted,
  inferWorkplaceFromText,
  normalizeFilterList,
} = require("./shared");

function mapJoobleJob(item, index, region) {
  const title = item.title || "Untitled Role";
  const company = item.company || "Unknown Company";
  const location = item.location || "Not specified";
  const description = item.snippet || item.description || "";
  const workplace = inferWorkplaceFromText(`${title} ${location} ${description}`);

  let postedAt = null;
  if (item.updated) {
    const d = new Date(item.updated);
    if (!Number.isNaN(d.getTime())) postedAt = d.toISOString();
  }

  return {
    id: item.id ? `jooble-${item.id}` : `jooble-${index}-${company.slice(0, 8)}`,
    title,
    company,
    location,
    workplace,
    employment_type: item.type || "",
    salary_min: 0,
    salary_max: 0,
    salary_unit: region.currency === "INR" ? "lpa" : "k",
    source: item.source || "Jooble",
    provider: "jooble",
    posted: formatPosted(postedAt),
    posted_at: postedAt,
    match_score: 0,
    apply_url: item.link || "",
    description,
    tags: [],
    logo_initials: company.slice(0, 2).toUpperCase(),
    employer_logo: null,
    api: item,
  };
}

async function fetchJoobleJobs(profile, filters, apiKey, region) {
  if (!apiKey) return [];

  const keywords = buildPrimaryQuery(profile);
  const cities = Array.isArray(filters.cities) ? filters.cities.filter(Boolean) : [];
  const workplaces = normalizeFilterList(filters.workplace, ["Remote", "Hybrid", "On-site"]);
  const remoteOnly = workplaces.length === 1 && workplaces[0] === "Remote";

  const location = remoteOnly ? "remote" : cities[0] || filters.region?.label || "";

  try {
    const response = await fetch(`https://jooble.org/api/${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        location,
        page: "1",
      }),
    });

    if (!response.ok) {
      console.warn("Jooble error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const results = data.jobs || data.results || [];
    console.log(`Jooble "${keywords}" @ ${location}: ${results.length} jobs`);
    return results.map((item, index) => mapJoobleJob(item, index, region));
  } catch (err) {
    console.warn("Jooble fetch failed:", err.message);
    return [];
  }
}

module.exports = { fetchJoobleJobs, mapJoobleJob };

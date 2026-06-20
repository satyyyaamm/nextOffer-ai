const { inferWorkplaceFromText, normalizeFilterList } = require("./shared");

function collectProfileSkills(profile) {
  const set = new Set();
  for (const list of [profile.skills, profile.technologies, profile.frameworks, profile.programming_languages]) {
    for (const item of list || []) {
      const s = String(item || "").trim().toLowerCase();
      if (s.length > 1) set.add(s);
    }
  }
  return [...set];
}

function collectProfileTitles(profile) {
  const titles = [];
  if (profile.title) titles.push(profile.title);
  for (const t of profile.job_titles || []) {
    if (t) titles.push(String(t));
  }
  return titles;
}

function extractJobSkillTokens(job) {
  return `${job.title} ${job.description} ${(job.tags || []).join(" ")}`.toLowerCase();
}

function scoreSkillMatch(job, profileSkills) {
  if (!profileSkills.length) return { score: 50, matching: [], missing: [] };
  const text = extractJobSkillTokens(job);
  const matching = [];
  const missing = [];
  for (const skill of profileSkills) {
    if (text.includes(skill)) matching.push(skill);
    else missing.push(skill);
  }
  // Hit-based scoring — don't penalise candidates with long skill lists (ratio-based was too harsh).
  const hits = matching.length;
  const score = Math.min(92, 35 + hits * 10);
  return {
    score,
    matching: matching.slice(0, 8).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())),
    missing: missing.slice(0, 6).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())),
  };
}

function scoreTitleMatch(job, profileTitles) {
  if (!profileTitles.length) return 40;
  const jobTitle = String(job.title || "").toLowerCase();
  let best = 0;
  for (const title of profileTitles) {
    const words = String(title).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) continue;
    let hits = 0;
    for (const w of words) {
      if (jobTitle.includes(w)) hits += 1;
    }
    best = Math.max(best, hits / words.length);
  }
  return Math.round(30 + best * 70);
}

function parseSeniorityFromJob(job) {
  const t = `${job.title} ${job.description}`.toLowerCase();
  if (/\b(principal|staff|director|head of)\b/.test(t)) return "senior";
  if (/\b(senior|sr\.?|lead|manager)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry|graduate|intern)\b/.test(t)) return "junior";
  return "mid";
}

function scoreExperienceMatch(job, profile) {
  const years = Number(profile.experience_years) || 0;
  const seniority = String(profile.seniority || "").toLowerCase();
  const jobLevel = parseSeniorityFromJob(job);

  if (years >= 8 || seniority.includes("senior") || seniority.includes("lead")) {
    if (jobLevel === "senior") return 95;
    if (jobLevel === "mid") return 75;
    return 55;
  }
  if (years >= 4 || seniority.includes("mid")) {
    if (jobLevel === "mid") return 90;
    if (jobLevel === "senior") return 70;
    return 65;
  }
  if (jobLevel === "junior") return 90;
  if (jobLevel === "mid") return 70;
  return 50;
}

function getExperienceFit(job, profile) {
  const expScore = scoreExperienceMatch(job, profile);
  if (expScore >= 85) return "Strong fit";
  if (expScore >= 65) return "Good fit";
  if (expScore >= 50) return "Stretch role";
  return "May be overqualified";
}

function scoreLocationMatch(job, profile, filters) {
  const pref = String(profile.location_preference || profile.location || "").toLowerCase();
  const jobLoc = String(job.location || "").toLowerCase();
  const cities = (filters.cities || []).map((c) => String(c).toLowerCase());
  const region = String(filters.region?.label || "").toLowerCase();
  const remoteOnly =
    Array.isArray(filters.workplace) &&
    filters.workplace.length === 1 &&
    filters.workplace[0] === "Remote";

  if (remoteOnly && job.workplace === "Remote") return 95;
  if (cities.some((c) => jobLoc.includes(c))) return 90;
  if (region && jobLoc.includes(region.split(" ")[0])) return 80;
  if (pref && (jobLoc.includes(pref) || pref.includes(jobLoc.split(",")[0]))) return 85;
  if (!pref && !cities.length) return 70;
  return 45;
}

function scoreIndustryMatch(job, profile) {
  const industry = String(profile.industry || "").toLowerCase();
  if (!industry) return 70;
  const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  if (text.includes(industry)) return 92;
  return 55;
}

function buildMatchReasons({ matching, titleScore, experienceFit }) {
  const reasons = [];
  for (const skill of matching.slice(0, 3)) {
    reasons.push(`${skill} skill match`);
  }
  if (titleScore >= 75) reasons.push("Job title aligns with your profile");
  if (experienceFit === "Strong fit" || experienceFit === "Good fit") {
    reasons.push(`${experienceFit.toLowerCase()} for your experience level`);
  }
  return reasons.slice(0, 4);
}

function scoreJobForProfile(job, profile, filters) {
  const profileSkills = collectProfileSkills(profile);
  const profileTitles = collectProfileTitles(profile);

  const skill = scoreSkillMatch(job, profileSkills);
  const titleScore = scoreTitleMatch(job, profileTitles);
  const experienceScore = scoreExperienceMatch(job, profile);
  const locationScore = scoreLocationMatch(job, profile, filters);
  const industryScore = scoreIndustryMatch(job, profile);

  const matchScore = Math.round(
    skill.score * 0.4 +
      titleScore * 0.2 +
      experienceScore * 0.2 +
      locationScore * 0.1 +
      industryScore * 0.1
  );

  const experienceFit = getExperienceFit(job, profile);
  const matchReasons = buildMatchReasons({
    matching: skill.matching,
    titleScore,
    experienceFit,
  });

  return {
    ...job,
    match_score: Math.min(100, Math.max(0, matchScore)),
    matching_skills: skill.matching,
    missing_skills: skill.missing,
    experience_fit: experienceFit,
    match_reasons: matchReasons,
  };
}

function scoreJobsForProfile(jobs, profile, filters) {
  return jobs.map((job) => scoreJobForProfile(job, profile, filters));
}

function applyExperienceLevelFilter(jobs, experienceLevel) {
  const level = String(experienceLevel || "any").toLowerCase();
  if (!level || level === "any") return jobs;

  return jobs.filter((job) => {
    const jobLevel = parseSeniorityFromJob(job);
    if (level === "junior") return jobLevel === "junior" || jobLevel === "mid";
    if (level === "mid") return jobLevel === "mid";
    if (level === "senior") return jobLevel === "senior" || jobLevel === "mid";
    return true;
  });
}

function applySourceFilter(jobs, sources) {
  const selected = normalizeFilterList(sources, []);
  if (!selected.length) return jobs;
  const normalized = selected.map((s) => String(s).toLowerCase());
  return jobs.filter((job) => normalized.includes(String(job.provider || "").toLowerCase()));
}

function applyRemoteOnlyFilter(jobs, filters) {
  const workplaces = normalizeFilterList(filters.workplace, ["Remote", "Hybrid", "On-site"]);
  const remoteOnly = workplaces.length === 1 && workplaces[0] === "Remote";
  if (!remoteOnly) return jobs;
  return jobs.filter(
    (job) => job.workplace === "Remote" || inferWorkplaceFromText(job.description) === "Remote"
  );
}

module.exports = {
  scoreJobsForProfile,
  applyExperienceLevelFilter,
  applySourceFilter,
  applyRemoteOnlyFilter,
};

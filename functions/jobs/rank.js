const { getPostedTimestamp } = require("./shared");

function rankJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const dateDiff = getPostedTimestamp(b.posted_at) - getPostedTimestamp(a.posted_at);
    if (dateDiff !== 0) return dateDiff;

    const scoreDiff = (b.match_score || 0) - (a.match_score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    return (b.salary_max || 0) - (a.salary_max || 0);
  });
}

module.exports = { rankJobs };

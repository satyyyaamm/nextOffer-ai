/** Claude Haiku 4.5 — keep in sync with MODEL in index.js */
const HAIKU_INPUT_USD_PER_M = 1.0;
const HAIKU_OUTPUT_USD_PER_M = 5.0;

const AI_ACTIONS = [
  "parseResume",
  "scoreJobs",
  "generateDocument",
  "analyzeLinkedIn",
  "generateLinkedInSection",
  "other",
];

function estimateAiCostUsd(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_M + (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_M;
}

module.exports = {
  HAIKU_INPUT_USD_PER_M,
  HAIKU_OUTPUT_USD_PER_M,
  AI_ACTIONS,
  estimateAiCostUsd,
};

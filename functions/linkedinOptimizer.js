const LINKEDIN_ANALYSIS_SYSTEM = `You are an expert LinkedIn profile coach.
Analyse the LinkedIn profile text and call submit_linkedin_analysis with scores for all 10 sections.

Required section ids in order:
headline, about, experience, skills, education, certifications, recommendations, featured, contact, keywords

Rules:
- status must be one of: good, needs_work, missing, weak
- scores are integers 0-100
- If a section is absent, use status missing and score 0-25
- Max 3 items in findings, gaps, suggestions; max 3 strengths; max 5 top_priorities
- Keep every string short`;

const LINKEDIN_ANALYSIS_TOOL = {
  name: "submit_linkedin_analysis",
  description: "Submit the completed LinkedIn profile analysis",
  input_schema: {
    type: "object",
    properties: {
      overall_score: { type: "integer", description: "Overall profile score 0-100" },
      summary: { type: "string", description: "2-3 sentence overview, max 400 chars" },
      strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
      top_priorities: { type: "array", items: { type: "string" }, maxItems: 5 },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              enum: [
                "headline",
                "about",
                "experience",
                "skills",
                "education",
                "certifications",
                "recommendations",
                "featured",
                "contact",
                "keywords",
              ],
            },
            title: { type: "string" },
            score: { type: "integer" },
            status: { type: "string", enum: ["good", "needs_work", "missing", "weak"] },
            findings: { type: "array", items: { type: "string" }, maxItems: 3 },
            gaps: { type: "array", items: { type: "string" }, maxItems: 3 },
            suggestions: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["id", "score", "status", "findings", "gaps", "suggestions"],
        },
      },
    },
    required: ["overall_score", "summary", "strengths", "top_priorities", "sections"],
  },
};

const SECTION_ORDER = [
  "headline",
  "about",
  "experience",
  "skills",
  "education",
  "certifications",
  "recommendations",
  "featured",
  "contact",
  "keywords",
];

const GENERATABLE_SECTION_IDS = [
  "headline",
  "about",
  "experience",
  "skills",
  "keywords",
  "featured",
  "recommendations",
];

const SECTION_TITLES = {
  headline: "Headline",
  about: "About",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
  recommendations: "Recommendations",
  featured: "Featured",
  contact: "Contact & links",
  keywords: "Keywords & discoverability",
};

function clampScore(n) {
  const v = Math.round(Number(n) || 0);
  return Math.min(100, Math.max(0, v));
}

function extractAnthropicText(response) {
  const blocks = response?.content || [];
  return blocks
    .filter((block) => block?.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractToolUseInput(response, toolName = LINKEDIN_ANALYSIS_TOOL.name) {
  for (const block of response?.content || []) {
    if (block?.type === "tool_use" && block.name === toolName && block.input) {
      return block.input;
    }
  }
  return null;
}

function repairJsonString(raw) {
  return String(raw || "")
    .replace(/```json|```/gi, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function parseLinkedInAnalysisText(text) {
  const clean = repairJsonString(text);
  const attempts = [clean];

  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(clean.slice(start, end + 1));
  }

  let lastError;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Invalid JSON from AI");
}

function normalizeAnalysis(raw) {
  const sectionsById = {};
  for (const section of raw?.sections || []) {
    if (!section?.id) continue;
    sectionsById[section.id] = {
      id: section.id,
      title: section.title || SECTION_TITLES[section.id] || section.id,
      score: clampScore(section.score),
      status: ["good", "needs_work", "missing", "weak"].includes(section.status)
        ? section.status
        : "needs_work",
      findings: Array.isArray(section.findings) ? section.findings.slice(0, 8).map(String) : [],
      gaps: Array.isArray(section.gaps) ? section.gaps.slice(0, 8).map(String) : [],
      suggestions: Array.isArray(section.suggestions) ? section.suggestions.slice(0, 8).map(String) : [],
    };
  }

  const sections = SECTION_ORDER.map((id) => {
    if (sectionsById[id]) return sectionsById[id];
    return {
      id,
      title: SECTION_TITLES[id],
      score: 0,
      status: "missing",
      findings: [],
      gaps: ["Section not detected in your LinkedIn export."],
      suggestions: ["Add this section on LinkedIn, then re-export or paste updated text."],
    };
  });

  return {
    overall_score: clampScore(raw?.overall_score),
    summary: String(raw?.summary || "Analysis complete.").slice(0, 2000),
    strengths: Array.isArray(raw?.strengths) ? raw.strengths.slice(0, 8).map(String) : [],
    top_priorities: Array.isArray(raw?.top_priorities) ? raw.top_priorities.slice(0, 5).map(String) : [],
    sections,
  };
}

function parseAndNormalizeAnalysis(text) {
  return normalizeAnalysis(parseLinkedInAnalysisText(text));
}

function parseAnalysisFromResponse(response) {
  const toolInput = extractToolUseInput(response);
  if (toolInput) {
    return { rawText: JSON.stringify(toolInput), analysis: normalizeAnalysis(toolInput) };
  }

  const rawText = extractAnthropicText(response);
  if (!rawText) {
    const reason = response?.stop_reason === "max_tokens" ? "AI response truncated" : "Empty AI response";
    throw new Error(reason);
  }

  return { rawText, analysis: parseAndNormalizeAnalysis(rawText) };
}

async function requestLinkedInAnalysis(createMessage, profileText, compact = false) {
  const clipped = String(profileText || "").slice(0, compact ? 12000 : 24000);
  const userPrompt = compact
    ? `Analyse this LinkedIn profile (keep strings very short):\n"""${clipped}"""`
    : `Analyse this LinkedIn profile export and score each section:\n"""${clipped}"""`;

  const response = await createMessage({
    max_tokens: compact ? 6000 : 8192,
    system: LINKEDIN_ANALYSIS_SYSTEM,
    tools: [LINKEDIN_ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: LINKEDIN_ANALYSIS_TOOL.name },
    messages: [{ role: "user", content: userPrompt }],
  });

  return parseAnalysisFromResponse(response);
}

async function runLinkedInAnalysis(createMessage, profileText) {
  try {
    return await requestLinkedInAnalysis(createMessage, profileText, false);
  } catch (firstErr) {
    console.warn("LinkedIn analysis pass 1 failed:", firstErr.message);
    try {
      return await requestLinkedInAnalysis(createMessage, profileText, true);
    } catch (secondErr) {
      console.error("LinkedIn analysis pass 2 failed:", secondErr.message);
      throw firstErr;
    }
  }
}

const LINKEDIN_GENERATION_SYSTEM = `You are an expert LinkedIn profile writer and career coach.
Write ready-to-paste LinkedIn content tailored to the candidate's real background.
Use ONLY facts from their profile — do not invent employers, degrees, certifications, projects, or metrics.
Plain text only: no markdown, no JSON, no code fences.`;

const SECTION_GENERATION_INSTRUCTIONS = {
  headline:
    "Write exactly 3 headline options, best first. Each max 220 characters. Format:\nOption 1: ...\nOption 2: ...\nOption 3: ...\nInclude role, niche, and value proposition with relevant keywords.",
  about:
    "Write a complete About section in first person (target 900–1500 characters). Structure: hook line, who you help, 2–3 proof points with metrics if available, skills/themes, soft CTA (e.g. open to opportunities). Ready to paste into LinkedIn.",
  experience:
    "Improve experience entries from their profile. For each role (most recent first, up to 4 roles): line \"ROLE at COMPANY (dates if known)\" then 3–5 bullet lines each starting with \"- \". Lead with impact and metrics. Rewrite weak bullets; do not add fake roles.",
  skills:
    "Output an optimized skills list for LinkedIn. Group with labels:\nCore: ...\nTools & technologies: ...\nSoft skills: ...\nList 15–25 skills total, most relevant first. Only skills supported by their background.",
  education:
    "Suggest how to present their education section. Include formatted entries (degree, school, dates if known) plus 1–2 optional detail lines per entry (honours, coursework, activities) only if inferable from profile.",
  certifications:
    "List certifications they should highlight or add if mentioned in profile. Format: \"Certification name — Issuer (year if known)\". If none in profile, suggest 2–3 relevant certs to pursue for their target role (label as \"Consider pursuing\").",
  recommendations:
    "Provide: (1) A short message template to request a recommendation from a manager/peers. (2) 3 themes/skills recommenders should mention based on their profile. (3) One sample recommendation paragraph they could ask a colleague to adapt (clearly label as sample).",
  featured:
    "Suggest 3 Featured section items: title + 1-line description for each (e.g. portfolio piece, article topic, case study, GitHub project). Base on their actual work/skills. Format numbered 1–3.",
  contact:
    "Write optimized contact lines for LinkedIn: location line, custom URL suggestion, and link labels. Use their real email/phone/URLs from profile when present; use [placeholder] only when missing.",
  keywords:
    "Output: (1) Top 20 search keywords/phrases for their role (comma-separated). (2) Where to place them: headline, about, experience (list 3 specific placements).",
};

function listSectionLines(items, label) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "";
  return `${label}:\n${list.map((item) => `- ${item}`).join("\n")}\n`;
}

function buildLinkedInSectionPrompt(sectionId, section, profileText, parsedProfile) {
  const instruction = SECTION_GENERATION_INSTRUCTIONS[sectionId];
  if (!instruction) {
    throw new Error(`Unknown section: ${sectionId}`);
  }

  const profileSlice = String(profileText || "").slice(0, 12000);
  const parsedSlice = parsedProfile && typeof parsedProfile === "object"
    ? JSON.stringify(parsedProfile, null, 2).slice(0, 4000)
    : "";

  let prompt = `Generate improved LinkedIn content for the "${section.title || sectionId}" section.\n\n`;
  prompt += `SECTION ANALYSIS (score ${section.score}/100, status: ${section.status}):\n`;
  prompt += listSectionLines(section.findings, "What works");
  prompt += listSectionLines(section.gaps, "Gaps to fix");
  prompt += listSectionLines(section.suggestions, "Suggestions");
  prompt += `\nTASK:\n${instruction}\n\n`;
  prompt += "Address the gaps above using their real background. Aim to raise this section's score.\n\n";

  if (profileSlice.length >= 50) {
    prompt += `LINKEDIN PROFILE TEXT:\n"""\n${profileSlice}\n"""\n\n`;
  }
  if (parsedSlice) {
    prompt += `PARSED RESUME PROFILE (supplementary):\n${parsedSlice}\n\n`;
  }
  if (profileSlice.length < 50 && !parsedSlice) {
    prompt += "Limited profile context — keep suggestions conservative and flag placeholders clearly.\n\n";
  }

  return prompt;
}

async function generateLinkedInSectionContent(createMessage, { sectionId, section, profileText, parsedProfile }) {
  const userPrompt = buildLinkedInSectionPrompt(sectionId, section, profileText, parsedProfile);
  const response = await createMessage({
    max_tokens: sectionId === "about" || sectionId === "experience" ? 2500 : 1500,
    system: LINKEDIN_GENERATION_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = extractAnthropicText(response);
  if (!content || content.length < 20) {
    throw new Error("Empty generation response");
  }
  return content.trim();
}

module.exports = {
  LINKEDIN_ANALYSIS_SYSTEM,
  LINKEDIN_ANALYSIS_TOOL,
  SECTION_ORDER,
  GENERATABLE_SECTION_IDS,
  normalizeAnalysis,
  parseLinkedInAnalysisText,
  parseAndNormalizeAnalysis,
  extractAnthropicText,
  extractToolUseInput,
  parseAnalysisFromResponse,
  runLinkedInAnalysis,
  generateLinkedInSectionContent,
  buildLinkedInSectionPrompt,
};

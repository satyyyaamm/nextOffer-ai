/**
 * NextOffer.ai — Secure Cloud Functions
 *
 * Secrets (firebase functions:secrets:set …):
 *   ANTHROPIC_API_KEY, RAPIDAPI_KEY
 *   JOOBLE_API_KEY (optional), ADZUNA_APP_ID, ADZUNA_APP_KEY (optional)
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 *   RAZORPAY_PLAN_ID_WEEKLY, RAZORPAY_PLAN_ID_MONTHLY
 *   GA4_API_SECRET (optional — server purchase_success events)
 *
 * GA4_MEASUREMENT_ID in functions/.env.nextoffer-ai (optional)
 */

const crypto = require("crypto");
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Anthropic } = require("@anthropic-ai/sdk");

admin.initializeApp();
const db = admin.firestore();

// ─── Secrets & config ────────────────────────────────────────────────────────
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const rapidApiKey = defineSecret("RAPIDAPI_KEY");
const rzKeyId = defineSecret("RAZORPAY_KEY_ID");
const rzKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const rzWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const rzPlanIdWeekly = defineSecret("RAZORPAY_PLAN_ID_WEEKLY");
const rzPlanIdMonthly = defineSecret("RAZORPAY_PLAN_ID_MONTHLY");
const ga4MeasurementId = defineString("GA4_MEASUREMENT_ID", { default: "" });
const ga4ApiSecret = defineSecret("GA4_API_SECRET");
const joobleApiKey = defineString("JOOBLE_API_KEY", { default: "" });
const adzunaAppId = defineString("ADZUNA_APP_ID", { default: "" });
const adzunaAppKey = defineString("ADZUNA_APP_KEY", { default: "" });
const adminEmails = defineString("ADMIN_EMAILS", { default: "" });
const adminPassword = defineString("ADMIN_PASSWORD", { default: "" });

const { runMultiSourceSearch } = require("./jobs/pipeline");
const { runLinkedInAnalysis, generateLinkedInSectionContent, GENERATABLE_SECTION_IDS } = require("./linkedinOptimizer");
const { logAiUsage } = require("./admin/aiLogger");
const { isAdminRequest } = require("./admin/auth");
const {
  validateAdminCredentials,
  createAdminSession,
  revokeAdminSession,
  requireAdminSession,
  stripSessionToken,
} = require("./admin/sessionAuth");
const { buildAdminDashboard, listUsers } = require("./admin/metrics");
const { scoreJobsForProfile, applyExperienceLevelFilter, applySourceFilter } = require("./jobs/matchScore");
const { rankJobs } = require("./jobs/rank");

const RZ_API = "https://api.razorpay.com/v1";
/** Billing cycles — high count so subscription runs until customer cancels. */
const RZ_SUBSCRIPTION_TOTAL_COUNT = 999;
const PRO_PRICE_USD = { weekly: 5.99, monthly: 9.99 };

const BASE_OPTS = { cors: true, invoker: "public" };
const AI_OPTS = { ...BASE_OPTS, secrets: [anthropicApiKey, rapidApiKey] };
const CHECKOUT_OPTS = {
  ...BASE_OPTS,
  secrets: [rzKeyId, rzKeySecret, rzPlanIdWeekly, rzPlanIdMonthly],
};
const RZ_WEBHOOK_OPTS = {
  secrets: [rzWebhookSecret, ga4ApiSecret],
  cors: false,
};

// Haiku 4.5 for all tiers (free + Pro) — lower cost than Sonnet
const MODEL = "claude-haiku-4-5";

const REGION_MAP = {
  "United States": { country: "us", language: "en", currency: "USD", symbol: "$" },
  India: { country: "in", language: "en", currency: "INR", symbol: "₹" },
  "United Kingdom": { country: "uk", language: "en", currency: "GBP", symbol: "£" },
  Canada: { country: "ca", language: "en", currency: "CAD", symbol: "C$" },
  Australia: { country: "au", language: "en", currency: "AUD", symbol: "A$" },
  Germany: { country: "de", language: "de", currency: "EUR", symbol: "€" },
};

const MAX_RESUME_CHARS = 15000;
const MAX_GENERATION_RESUME_CHARS = 12000;
const MAX_JOB_DESC_CHARS = 6000;
const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DAILY_AI_CALLS = 50;
const JSEARCH_INITIAL_PAGES = 3; // pages per query (~10 jobs each on most plans)
const JSEARCH_PAGE_SIZE = 10;
const AI_SCORE_BATCH_SIZE = 15;
const MIN_JOBS_TARGET = 12;
/** Free-tier monthly search only counts when the user receives at least one job. */
const MIN_JOBS_TO_COUNT_FREE_SEARCH = 1;
const MAX_QUERY_VARIANTS = 4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid;
}

function sanitizeText(text, maxLen) {
  if (typeof text !== "string") return "";
  return text.slice(0, maxLen).replace(/\0/g, "").trim();
}

async function extractResumeText(data) {
  const pdfBase64 = data?.resumePdfBase64 || data?.linkedinPdfBase64;
  const isLinkedInExport = Boolean(data?.linkedinPdfBase64);
  const linkedinText = sanitizeText(data?.linkedinProfileText, MAX_RESUME_CHARS);

  if (pdfBase64) {
    let buffer;
    try {
      buffer = Buffer.from(pdfBase64, "base64");
    } catch {
      throw new HttpsError("invalid-argument", "Invalid PDF file encoding.");
    }

    if (buffer.length > MAX_PDF_BYTES) {
      throw new HttpsError("invalid-argument", "PDF must be smaller than 5 MB.");
    }
    if (buffer.length < 100) {
      throw new HttpsError("invalid-argument", "PDF file appears empty or corrupted.");
    }

    try {
      const pdfParse = require("pdf-parse");
      const parsed = await pdfParse(buffer);
      const text = sanitizeText(parsed.text, MAX_RESUME_CHARS);
      if (text.length < 50) {
        throw new HttpsError(
          "invalid-argument",
          isLinkedInExport
            ? "Could not read enough text from this LinkedIn PDF. Export from LinkedIn (More → Save to PDF) and try again."
            : "Could not read enough text from this PDF. Try a text-based PDF or paste your resume instead."
        );
      }
      return {
        text,
        source: "pdf",
        fileName: data?.fileName || (isLinkedInExport ? "linkedin.pdf" : "resume.pdf"),
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("PDF parse error:", err.message);
      throw new HttpsError(
        "invalid-argument",
        isLinkedInExport
          ? "Could not read this LinkedIn PDF. Use LinkedIn's Save to PDF export."
          : "Could not read this PDF. Use a standard resume PDF or paste text."
      );
    }
  }

  if (isLinkedInExport && linkedinText.length >= 50) {
    return { text: linkedinText, source: "text", fileName: data?.fileName || "linkedin-profile.txt" };
  }

  const text = sanitizeText(data?.resumeText, MAX_RESUME_CHARS);
  if (text.length < 50) {
    throw new HttpsError(
      "invalid-argument",
      isLinkedInExport
        ? "Please upload a LinkedIn PDF export or paste your profile text (at least 50 characters)."
        : "Please paste at least 50 characters or upload a PDF resume."
    );
  }
  return { text, source: "text", fileName: null };
}

function getAnthropic(apiKey) {
  return new Anthropic({ apiKey });
}

function anthropicErrorToHttps(err) {
  const apiMsg =
    err?.error?.error?.message ||
    err?.message ||
    "AI request failed";
  if (err?.status === 404 && String(apiMsg).includes("model")) {
    return new HttpsError(
      "failed-precondition",
      `AI model not available (${apiMsg}). Redeploy functions with updated model IDs.`
    );
  }
  if (err?.status === 401 || err?.status === 403) {
    return new HttpsError(
      "failed-precondition",
      "Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY in Firebase secrets."
    );
  }
  if (err?.status === 429) {
    return new HttpsError("resource-exhausted", "AI rate limit reached. Try again in a few minutes.");
  }
  console.error("Anthropic API error:", apiMsg, err?.status);
  return new HttpsError("internal", `AI processing failed: ${apiMsg}`);
}

async function createAnthropicMessage(anthropic, params, meta = {}) {
  try {
    const response = await anthropic.messages.create(params);
    if (meta?.action) {
      logAiUsage(meta.userId, meta.action, response.usage).catch((err) => {
        console.warn("AI usage log failed:", err.message);
      });
    }
    return response;
  } catch (err) {
    throw anthropicErrorToHttps(err);
  }
}

async function recordBillingEvent(userId, event) {
  const patch = {
    "billing.lastCheckoutAt": admin.firestore.FieldValue.serverTimestamp(),
    "billing.lastCheckoutPlan": event.plan || null,
    "billing.lastCheckoutStatus": event.status,
    "billing.lastSubscriptionId": event.subscriptionId || null,
  };
  if (event.status === "started") {
    patch["billing.checkoutAttempts"] = admin.firestore.FieldValue.increment(1);
  }
  await db.collection("users").doc(userId).set(patch, { merge: true });
  await db
    .collection("users")
    .doc(userId)
    .collection("billingEvents")
    .add({
      type: event.status,
      plan: event.plan || null,
      subscriptionId: event.subscriptionId || null,
      note: event.note || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function getUser(userId) {
  const doc = await db.collection("users").doc(userId).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  return { id: userId, ...doc.data() };
}

async function hydrateParsedProfileFromResumes(userId, userData) {
  if (userData.parsedProfile?.title) return userData;

  const latest = await db
    .collection("users")
    .doc(userId)
    .collection("resumes")
    .orderBy("uploadedAt", "desc")
    .limit(1)
    .get();

  if (latest.empty) return userData;

  const parsed = latest.docs[0].data().parsed;
  if (!parsed?.title) return userData;

  await db.collection("users").doc(userId).update({
    parsedProfile: parsed,
    parsedProfileUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ...userData, parsedProfile: parsed };
}

async function ensureUserExists(request) {
  const userId = requireAuth(request);
  const ref = db.collection("users").doc(userId);
  const doc = await ref.get();

  if (!doc.exists) {
    const newUser = {
      email: request.auth.token.email || "",
      name: request.auth.token.name || "User",
      tier: "free",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      searches: { count: 0, lastReset: admin.firestore.Timestamp.now() },
      resumeUploads: { count: 0, lastReset: admin.firestore.Timestamp.now() },
      applicationKit: {
        jobId: null,
        kitKey: null,
        resume: false,
        cover_letter: false,
        cold_email: false,
        complete: false,
        lastReset: admin.firestore.Timestamp.now(),
      },
      linkedinAnalysis: { count: 0, lastReset: admin.firestore.Timestamp.now() },
    };
    await ref.set(newUser);
    const created = await ref.get();
    return { id: userId, ...created.data() };
  }

  const userData = { id: userId, ...doc.data() };
  return hydrateParsedProfileFromResumes(userId, userData);
}

function requireProTier(user, featureName = "This feature") {
  if (user.tier !== "pro") {
    throw new HttpsError(
      "failed-precondition",
      `PRO_ONLY:linkedin: ${featureName} is available on Pro only. Upgrade to unlock.`
    );
  }
}

function resetMonthlyCounter(counter) {
  const now = new Date();
  const lastReset = counter?.lastReset?.toDate?.() || new Date(0);
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    return { count: 0, lastReset: admin.firestore.Timestamp.now() };
  }
  return counter || { count: 0, lastReset: admin.firestore.Timestamp.now() };
}

/** Callable responses must be plain JSON — Firestore Timestamps break serialization. */
function serializeForClient(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeForClient);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serializeForClient(val);
    }
    return out;
  }
  return value;
}

function sanitizeJobKey(job) {
  const key = String(job?.id || job?.title || "unknown");
  return key.replace(/[/\\.#\[\]]/g, "_").slice(0, 150);
}

/** One kit per company + job title (regenerating updates the same doc). */
function sanitizeKitKey(job) {
  const company = String(job?.company || "unknown").trim().toLowerCase();
  const title = String(job?.title || job?.id || "role").trim().toLowerCase();
  const raw = `${company}__${title}`;
  return raw.replace(/[/\\.#\[\]]/g, "_").slice(0, 150);
}

function jobKitsCollection(userId) {
  return db.collection("users").doc(userId).collection("jobKits");
}

/** Delete documents from a collection in batches (max 400 per commit). */
async function deleteCollectionDocs(collectionRef, batchSize = 400) {
  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snapshot.size < batchSize) break;
  }
}

async function deleteAllUserFirestoreData(userId) {
  const userRef = db.collection("users").doc(userId);
  for (const sub of ["resumes", "jobKits", "documents", "linkedinAnalyses"]) {
    await deleteCollectionDocs(userRef.collection(sub));
  }
  const searchHistoryRef = db.collection("searches").doc(userId).collection("history");
  await deleteCollectionDocs(searchHistoryRef);
  try {
    await db.collection("searches").doc(userId).delete();
  } catch {
    /* optional parent doc */
  }
  try {
    await db.collection("rateLimits").doc(userId).delete();
  } catch {
    /* optional */
  }
  await userRef.delete();
}

async function deleteUserResumeData(userId) {
  const userRef = db.collection("users").doc(userId);
  await deleteCollectionDocs(userRef.collection("resumes"));
  await userRef.update({
    parsedProfile: admin.firestore.FieldValue.delete(),
    parsedProfileUpdatedAt: admin.firestore.FieldValue.delete(),
    latestResumeId: admin.firestore.FieldValue.delete(),
    hasStoredResumeText: false,
  });
}

function jobKitRefByKey(userId, kitKey) {
  return jobKitsCollection(userId).doc(kitKey);
}

function jobKitRef(userId, job) {
  return jobKitRefByKey(userId, sanitizeKitKey(job));
}

function buildJobSnapshot(job) {
  const api = job?.api || {};
  const rawDesc = api.job_description || job.description || "";
  const description = stripHtmlForGeneration(rawDesc).slice(0, 8000);
  return {
    title: job?.title || "",
    company: job?.company || "",
    location: job?.location || "",
    workplace: job?.workplace || "",
    employment_type: job?.employment_type || "",
    posted: job?.posted || "",
    description,
    apply_url: job?.apply_url || api.job_apply_link || "",
    source: job?.source || api.job_publisher || "",
    salary_min: job?.salary_min ?? null,
    salary_max: job?.salary_max ?? null,
    salary_unit: job?.salary_unit || "",
    match_score: job?.match_score ?? null,
    originalJobId: job?.id || "",
  };
}

function emptyJobKit() {
  return {
    resume: null,
    cover_letter: null,
    cold_email: null,
    updatedAt: null,
    jobTitle: null,
    company: null,
    location: null,
    workplace: null,
    posted: null,
    applyUrl: null,
    jobId: null,
    kitKey: null,
    jobSnapshot: null,
  };
}

function parseKitDoc(data, docId) {
  if (!data) return emptyJobKit();
  const snapshot = data.jobSnapshot || null;
  return {
    resume: data.resume || null,
    cover_letter: data.cover_letter || null,
    cold_email: data.cold_email || null,
    updatedAt: data.updatedAt,
    jobTitle: data.jobTitle || snapshot?.title || null,
    company: data.company || snapshot?.company || null,
    location: data.location || snapshot?.location || null,
    workplace: data.workplace || snapshot?.workplace || null,
    posted: data.posted || snapshot?.posted || null,
    applyUrl: data.applyUrl || snapshot?.apply_url || null,
    jobId: data.jobId || snapshot?.originalJobId || docId,
    kitKey: data.kitKey || docId,
    jobSnapshot: snapshot,
  };
}

async function migrateLegacyKitIfNeeded(userId, job, kitKey) {
  const legacyKey = sanitizeJobKey(job);
  if (legacyKey === kitKey) return;
  const legacyRef = jobKitRefByKey(userId, legacyKey);
  const legacySnap = await legacyRef.get();
  if (!legacySnap.exists) return;
  const newRef = jobKitRefByKey(userId, kitKey);
  const newSnap = await newRef.get();
  if (newSnap.exists) {
    await legacyRef.delete();
    return;
  }
  await newRef.set({ ...legacySnap.data(), kitKey }, { merge: true });
  await legacyRef.delete();
}

async function resolveKitKey(userId, { kitKey, job } = {}) {
  if (kitKey) return kitKey;
  if (!job) return null;
  if (job.company && job.title) {
    const primary = sanitizeKitKey(job);
    const primarySnap = await jobKitRefByKey(userId, primary).get();
    if (primarySnap.exists) return primary;
  }
  if (job.id || job.title) {
    const legacyKey = sanitizeJobKey(job);
    const legacySnap = await jobKitRefByKey(userId, legacyKey).get();
    if (legacySnap.exists) return legacyKey;
    if (job.company && job.title) return sanitizeKitKey(job);
    return legacyKey;
  }
  return null;
}

async function saveJobKitDocument(userId, job, documentType, content) {
  const kitKey = sanitizeKitKey(job);
  await migrateLegacyKitIfNeeded(userId, job, kitKey);
  const snapshot = buildJobSnapshot(job);
  await jobKitRefByKey(userId, kitKey).set(
    {
      [documentType]: content,
      kitKey,
      jobId: job.id || kitKey,
      jobTitle: snapshot.title,
      company: snapshot.company,
      location: snapshot.location,
      workplace: snapshot.workplace,
      posted: snapshot.posted,
      applyUrl: snapshot.apply_url,
      jobSnapshot: snapshot,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function loadJobKit(userId, { kitKey, job } = {}) {
  const key = kitKey || (await resolveKitKey(userId, { kitKey, job }));
  if (!key) return emptyJobKit();
  const snap = await jobKitRefByKey(userId, key).get();
  if (!snap.exists) return emptyJobKit();
  return parseKitDoc(snap.data(), snap.id);
}

/** Resume text lives only under users/{uid}/resumes (client cannot read). */
function serializeUserForClient(user, { hasStoredResumeText } = {}) {
  const serialized = serializeForClient(user);
  if (typeof hasStoredResumeText === "boolean") {
    serialized.hasStoredResumeText = hasStoredResumeText;
  }
  return serialized;
}

function stripHtmlForGeneration(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatJobHighlightsForPrompt(job) {
  const highlights = job?.api?.job_highlights || job?.job_highlights;
  if (!highlights || typeof highlights !== "object") return "";
  return Object.entries(highlights)
    .map(([section, items]) => {
      const list = (Array.isArray(items) ? items : [items]).filter(Boolean).join("\n- ");
      return list ? `${section}:\n- ${list}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildGenerationContext(profile, resumeText, job) {
  const api = job?.api || {};
  const rawDesc = api.job_description || job.description || "";
  const description = stripHtmlForGeneration(rawDesc).slice(0, MAX_JOB_DESC_CHARS);
  const highlights = formatJobHighlightsForPrompt(job);
  const resumeSlice = sanitizeText(resumeText, MAX_GENERATION_RESUME_CHARS);

  let block = `CANDIDATE (parsed from resume):\n${JSON.stringify(profile, null, 2)}\n\n`;

  if (resumeSlice.length >= 50) {
    block += `ORIGINAL RESUME (source of truth — do not invent employers, dates, degrees, or projects not listed here):\n"""\n${resumeSlice}\n"""\n\n`;
  } else {
    block += `ORIGINAL RESUME: Not available on file. Use only facts from the parsed candidate JSON above. Do not invent experience.\n\n`;
  }

  block += `TARGET JOB:\nTitle: ${job.title || "Unknown"}\nCompany: ${job.company || "Unknown"}\n`;
  if (job.location) block += `Location: ${job.location}\n`;
  if (job.workplace) block += `Workplace: ${job.workplace}\n`;
  if (job.employment_type) block += `Employment type: ${job.employment_type}\n`;
  if (description) block += `\nJob description:\n${description}\n`;
  if (highlights) block += `\nJob highlights:\n${highlights}\n`;

  return block;
}

async function resolveResumeTextForUser(userId, userData) {
  const resumeRef = userData.latestResumeId
    ? db.collection("users").doc(userId).collection("resumes").doc(userData.latestResumeId)
    : null;

  if (resumeRef) {
    const doc = await resumeRef.get();
    if (doc.exists) {
      const text = sanitizeText(doc.data().resumeText, MAX_GENERATION_RESUME_CHARS);
      if (text.length >= 50) return text;
    }
  }

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("resumes")
    .orderBy("uploadedAt", "desc")
    .limit(1)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    const text = sanitizeText(doc.data().resumeText, MAX_GENERATION_RESUME_CHARS);
    if (text.length >= 50) {
      if (userData.latestResumeId !== doc.id) {
        await db.collection("users").doc(userId).update({
          latestResumeId: doc.id,
          hasStoredResumeText: true,
        });
      }
      return text;
    }
  }

  return "";
}

const GENERATION_GROUNDING_RULES =
  "Use ONLY facts from the candidate's original resume and parsed profile (real employers, dates, degrees, metrics). Do NOT invent jobs, companies, education, or numbers. You MAY rewrite wording, reorder sections, shorten less relevant content, and retitle the headline for the target role when honest.";

const ATS_RESUME_RULES = `
ATS rules: Plain text only (no tables, columns, images, emoji, or markdown). Use simple section headings in ALL CAPS. Use hyphen bullets only, each line starting with "- " (ASCII hyphen, not special bullet symbols). Weave TARGET JOB keywords naturally — never keyword-stuff.`;

const RESUME_TAILORING_RULES = `
TAILORING (required — not a copy-paste):
- This document must be REWRITTEN for the TARGET JOB. Do not reuse long phrases verbatim from the original resume.
- Change the headline/title line to align with the target job title when it matches the candidate's background.
- Rewrite every bullet with fresh phrasing; lead with achievements most relevant to this job.
- Prioritize and expand matching experience; condense or omit projects/roles that do not support this application.
- Order skills so job-relevant technologies appear first.
- Include only sections that strengthen this application (e.g. skip "Additional Credentials" if empty or irrelevant).`;

function formatContactLine(profile) {
  const parts = [];
  if (profile.location) parts.push(profile.location);
  const contacts = [];
  if (profile.email) contacts.push(profile.email);
  if (profile.phone) contacts.push(profile.phone);
  const links = [];
  if (profile.linkedin) links.push("LinkedIn");
  if (profile.github) links.push("GitHub");
  if (profile.portfolio) links.push("Portfolio");
  else if (profile.website) links.push("Portfolio");
  return { locationLine: parts.join(" · "), contactLine: contacts.join(" | "), linksLine: links.join(" | ") };
}

function buildDocumentPrompts(documentType, contextBlock, profile) {
  const name = profile.name || "Candidate";
  const { locationLine, contactLine, linksLine } = formatContactLine(profile);
  const contactHints = [
    locationLine ? `Location (from profile): ${locationLine}` : "",
    contactLine ? `Contact (from profile): ${contactLine}` : "",
    linksLine ? `Links (from profile): ${linksLine}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompts = {
    resume: {
      system: `You are an expert ATS resume writer. ${GENERATION_GROUNDING_RULES} ${ATS_RESUME_RULES} ${RESUME_TAILORING_RULES}`,
      user: `${contextBlock}
${contactHints ? `\nPARSED CONTACT (use if not in original resume):\n${contactHints}\n` : ""}

Write a complete, job-tailored resume for ${name} for the TARGET JOB above.

Output plain text ONLY. Build the best resume for THIS job — flexible structure, not a rigid template.

Suggested flow (include only what helps; omit empty sections):
- Name on line 1
- Headline aligned to the target job (not necessarily identical to the uploaded resume title)
- Contact line(s): location, email, phone on one line; links on the next line as plain labels, e.g. GitHub | LinkedIn | Portfolio (no raw URLs, no brackets)
- PROFESSIONAL SUMMARY — 3-4 sentences rewritten for this role; mirror language from the job description
- TECHNICAL SKILLS and/or CORE SKILLS — group with lines like: - Mobile: Flutter, Dart, ...
- PROFESSIONAL EXPERIENCE — for each relevant role: Job title, then Company · Location | dates, then 3-6 bullets starting with "- "
  Put the most relevant role first in emphasis (more bullets); trim unrelated work
- EDUCATION — if present in source
- Optional: PROJECTS, CERTIFICATIONS, or ADDITIONAL — only if they add value for this job

Rules:
- Every bullet MUST start with "- " (ASCII hyphen + space)
- Rewrite bullets; do NOT copy sentences unchanged from the original resume
- Use metrics and facts only from the source resume
- No emoji, no markdown, no special Unicode bullets`,
      maxTokens: 4096,
    },
    cover_letter: {
      system: `You are an expert cover letter writer. ${GENERATION_GROUNDING_RULES}`,
      user: `${contextBlock}\n\nWrite a compelling cover letter for ${name} applying to this job. Three paragraphs: hook + fit to role, evidence from resume matched to job requirements, close with enthusiasm. Professional but personable.`,
      maxTokens: 1800,
    },
    cold_email: {
      system: `You are an expert at cold outreach emails. ${GENERATION_GROUNDING_RULES}`,
      user: `${contextBlock}\n\nWrite a cold outreach email for ${name} targeting this company for the ${profile.title || "role"} opening. Include Subject line + body under 150 words. Reference one concrete achievement from the resume that matches the job.`,
      maxTokens: 800,
    },
  };

  return prompts[documentType];
}

/** Plain-text cleanup for storage and PDF (ASCII-safe bullets). */
function normalizeResumeOutput(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/●/g, "-")
    .replace(/[•◦▪▸►]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/^[\s]*[●•]\s*/gm, "- ")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resetApplicationKit(kit) {
  const now = new Date();
  const lastReset = kit?.lastReset?.toDate?.() || new Date(0);
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    return {
      jobId: null,
      kitKey: null,
      resume: false,
      cover_letter: false,
      cold_email: false,
      complete: false,
      lastReset: admin.firestore.Timestamp.now(),
    };
  }
  return (
    kit || {
      jobId: null,
      kitKey: null,
      resume: false,
      cover_letter: false,
      cold_email: false,
      complete: false,
      lastReset: admin.firestore.Timestamp.now(),
    }
  );
}

function hasUsedFreeGeneration(kit) {
  const k = resetApplicationKit(kit);
  return Boolean(k.resume || k.cover_letter || k.cold_email);
}

function isApplicationKitComplete(kit) {
  const k = resetApplicationKit(kit);
  return Boolean(k.complete || (k.resume && k.cover_letter && k.cold_email));
}

async function checkRateLimit(userId, action) {
  const ref = db.collection("rateLimits").doc(userId);
  const today = new Date().toISOString().slice(0, 10);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() || {};
    const dayData = data[today] || {};
    const count = (dayData[action] || 0) + 1;

    if (count > MAX_DAILY_AI_CALLS) {
      throw new HttpsError("resource-exhausted", "Daily limit reached. Try again tomorrow.");
    }

    tx.set(ref, { [today]: { ...dayData, [action]: count } }, { merge: true });
  });
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

const MIN_JOBS_AFTER_DATE_FILTER = 5;

/** JSearch has no sort param — we filter via date_posted and sort by job_posted_at_datetime_utc. */
function resolveJSearchDatePosted(datePosted) {
  const key = String(datePosted || "week").toLowerCase();
  // Use API "week" for 24h requests too — "today" often returns 0–1 jobs; we trim to 24h locally.
  if (key === "24h" || key === "today" || key === "day") {
    return { api: "week", maxAgeHours: 24, requested: "24h", fallback: "week" };
  }
  if (key === "week" || key === "7d") {
    return { api: "week", maxAgeHours: 24 * 7, requested: "week", fallback: "month" };
  }
  if (key === "month" || key === "30d") {
    return { api: "month", maxAgeHours: 24 * 31, requested: "month", fallback: null };
  }
  if (key === "all") return { api: "all", maxAgeHours: null, requested: "all", fallback: null };
  return { api: "week", maxAgeHours: 24 * 7, requested: "week", fallback: "month" };
}

function isJobWithinMaxAge(isoDate, maxAgeHours) {
  if (!maxAgeHours) return true;
  const posted = getPostedTimestamp(isoDate);
  if (!posted) return true;
  return Date.now() - posted <= maxAgeHours * 3600000;
}

function sortJobsNewestFirst(jobs) {
  return [...jobs].sort((a, b) => {
    const dateDiff = getPostedTimestamp(b.posted_at) - getPostedTimestamp(a.posted_at);
    if (dateDiff !== 0) return dateDiff;
    return (b.match_score || 0) - (a.match_score || 0);
  });
}

function annualizeSalaryAmount(amount, period) {
  if (amount == null || !Number.isFinite(amount)) return null;
  const p = String(period || "YEAR").toUpperCase();
  if (p.includes("HOUR")) return amount * 2080;
  if (p.includes("MONTH")) return amount * 12;
  if (p.includes("WEEK")) return amount * 52;
  if (p.includes("DAY")) return amount * 260;
  return amount;
}

/** Normalize JSearch salary fields to annual full currency units (e.g. USD 85000, INR 1200000). */
function getJobAnnualSalaryRange(job) {
  const period = job.job_salary_period || "YEAR";
  let min = annualizeSalaryAmount(job.job_min_salary, period);
  let max = annualizeSalaryAmount(job.job_max_salary, period);
  if (min == null && max == null) return null;
  if (min == null) min = max;
  if (max == null) max = min;
  if (min > max) [min, max] = [max, min];
  return { min, max, currency: (job.job_salary_currency || "USD").toUpperCase() };
}

/** Convert filter slider values to annual amounts for comparison. */
function filterSalaryToAnnualRange(filters, region) {
  const [lo, hi] = filters.salary || [20, 250];
  if (region.currency === "INR") {
    // UI uses LPA (lakhs per year) for India
    return { min: lo * 100000, max: hi * 100000 };
  }
  // US, UK, etc. — slider is thousands per year
  return { min: lo * 1000, max: hi * 1000 };
}

function annualToDisplayThousands(jobRange, region) {
  if (!jobRange) return { salary_min: 0, salary_max: 0 };
  if (region.currency === "INR") {
    return {
      salary_min: Math.round(jobRange.min / 100000),
      salary_max: Math.round(jobRange.max / 100000),
      salary_unit: "lpa",
    };
  }
  return {
    salary_min: Math.round(jobRange.min / 1000),
    salary_max: Math.round(jobRange.max / 1000),
    salary_unit: "k",
  };
}

function jobMatchesSalaryFilter(job, filterAnnual, region) {
  const jobRange = getJobAnnualSalaryRange(job);
  if (!jobRange) return true;

  const jobCurrency = jobRange.currency;
  const regionCurrency = region.currency || "USD";
  // Skip strict filter when currencies differ (avoid dropping all India/US mismatches)
  if (jobCurrency !== regionCurrency) return true;

  return jobRange.max >= filterAnnual.min && jobRange.min <= filterAnnual.max;
}

function normalizeFilterList(value, fallback) {
  if (Array.isArray(value) && value.length > 0) return value;
  if (typeof value === "string" && value) return [value];
  return fallback;
}

const CITY_ALIASES = {
  bangalore: "bengaluru",
  gurugram: "gurgaon",
  "new york city": "new york",
  nyc: "new york",
  "san fran": "san francisco",
  "washington dc": "washington",
  "national capital territory": "delhi",
  ncr: "delhi",
};

function normalizeCityKey(city) {
  const key = String(city || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  return CITY_ALIASES[key] || key;
}

function cityMatchesSelection(job, selectedCities) {
  const cities = Array.isArray(selectedCities) ? selectedCities.filter(Boolean) : [];
  if (cities.length === 0) return true;

  const locationParts = [job.job_city, job.job_state, job.job_country].filter(Boolean);
  const haystack = locationParts.map(normalizeCityKey).join(" ");

  return cities.some((selected) => {
    const needle = normalizeCityKey(selected);
    if (!needle) return false;
    return locationParts.some((part) => {
      const partKey = normalizeCityKey(part);
      return partKey === needle || partKey.includes(needle) || needle.includes(partKey);
    }) || haystack.includes(needle);
  });
}

function resolveJSearchLocation(filters) {
  const cities = Array.isArray(filters.cities) ? filters.cities.filter(Boolean) : [];
  if (cities.length === 1) return cities[0];
  return null;
}

function inferWorkplaceType(job) {
  if (job.job_is_remote === true) return "Remote";
  const wt = String(job.job_workplace_type || "").toLowerCase();
  if (wt.includes("remote")) return "Remote";
  if (wt.includes("hybrid")) return "Hybrid";
  if (wt.includes("on-site") || wt.includes("onsite") || wt.includes("on site")) return "On-site";
  return job.job_workplace_type || "On-site";
}

function matchesWorkplaceFilter(mappedJob, workplaces) {
  const selected = normalizeFilterList(workplaces, ["Remote", "Hybrid", "On-site"]);
  return selected.includes(mappedJob.workplace);
}

function matchesJobTypeFilter(rawJob, jobTypes) {
  const selected = normalizeFilterList(jobTypes, ["Full-time", "Part-time"]);
  const emp = String(rawJob.job_employment_type || "").toUpperCase();
  if (!emp) return true;

  const isPart = emp.includes("PART");
  const isFull = emp.includes("FULL") || emp.includes("CONTRACT") || emp.includes("INTERN");

  if (selected.includes("Part-time") && isPart) return true;
  if (selected.includes("Full-time") && (isFull || !isPart)) return true;
  return false;
}

function mapJSearchJob(job, index, region) {
  const jobRange = getJobAnnualSalaryRange(job);
  const { salary_min, salary_max, salary_unit } = annualToDisplayThousands(jobRange, region);
  const workplace = inferWorkplaceType(job);

  return {
    id: job.job_id || `job-${index}`,
    title: job.job_title || "Untitled Role",
    company: job.employer_name || "Unknown Company",
    location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || "Not specified",
    workplace,
    employment_type: job.job_employment_type || "",
    salary_min,
    salary_max,
    salary_unit: salary_unit || "k",
    source: job.job_publisher || "Job Board",
    provider: "jsearch",
    posted: formatPosted(job.job_posted_at_datetime_utc),
    posted_at: job.job_posted_at_datetime_utc || null,
    match_score: 0,
    apply_url: job.job_apply_link || "",
    description: job.job_description || "",
    tags: (job.job_highlights?.Qualifications || []).slice(0, 3),
    logo_initials: (job.employer_name || "??").slice(0, 2).toUpperCase(),
    employer_logo: job.employer_logo || null,
    api: job,
  };
}

function cleanJobTitle(title) {
  if (!title) return "software engineer";
  let t = String(title).trim();
  t = t.split(/[|•/–—>]/)[0].trim();
  t = t.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return t || "software engineer";
}

/** Short, Google-friendly queries — long titles (e.g. with "|") return almost no JSearch results. */
function buildSearchQueryVariants(profile) {
  const title = cleanJobTitle(profile.title);
  const words = title.split(/\s+/).filter((w) => w.length > 1);
  const variants = [];

  const add = (q) => {
    const s = String(q || "").trim().slice(0, 80);
    if (s && !variants.includes(s)) variants.push(s);
  };

  add(words.slice(0, 4).join(" "));
  if (words.length > 2) add(words.slice(0, 3).join(" "));
  if (words.length > 1) add(words.slice(0, 2).join(" "));

  const noLevel = words.filter((w) => !/^(senior|sr|junior|jr|lead|principal|staff|ii|iii)$/i.test(w));
  if (noLevel.length >= 2 && noLevel.length < words.length) {
    add(noLevel.slice(0, 4).join(" "));
  }

  for (const skill of (profile.skills || []).slice(0, 2)) {
    if (!skill) continue;
    const sk = String(skill).trim();
    if (!title.toLowerCase().includes(sk.toLowerCase())) {
      add(`${sk} developer`);
    }
  }

  return variants.slice(0, MAX_QUERY_VARIANTS);
}

async function requestJSearchRaw(query, filters, region, apiKey, { apiPage = 1, numPages = 1, locationOverride = null } = {}) {
  const workplaces = normalizeFilterList(filters.workplace, ["Remote", "Hybrid", "On-site"]);
  const jobTypes = normalizeFilterList(filters.jobType, ["Full-time", "Part-time"]);
  const onlyRemote =
    workplaces.length === 1 && workplaces.includes("Remote") && !workplaces.includes("Hybrid");
  const { api: datePostedApi } = resolveJSearchDatePosted(filters.datePosted);

  const params = new URLSearchParams({
    query,
    page: String(apiPage),
    num_pages: String(numPages),
    country: region.country,
    language: region.language,
    date_posted: datePostedApi,
  });

  const wantsFull = jobTypes.includes("Full-time");
  const wantsPart = jobTypes.includes("Part-time");
  if (wantsFull && !wantsPart) params.set("employment_types", "FULLTIME");
  else if (wantsPart && !wantsFull) params.set("employment_types", "PARTTIME");

  if (onlyRemote) params.set("work_from_home", "true");

  const location = locationOverride || resolveJSearchLocation(filters);
  if (location) params.set("location", location);

  const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("JSearch error:", response.status, query, errText);
    if (response.status === 403) {
      throw new HttpsError(
        "failed-precondition",
        "RapidAPI JSearch is not subscribed. Subscribe at rapidapi.com/openweb-ninja/api/jsearch and set RAPIDAPI_KEY in Firebase secrets."
      );
    }
    if (response.status === 429) {
      throw new HttpsError("resource-exhausted", "Job search rate limit reached. Try again in a few minutes.");
    }
    throw new HttpsError("unavailable", `Job search failed (${response.status}). Check RapidAPI JSearch subscription and quota.`);
  }

  const data = await response.json();
  return data.data || [];
}

function applyJobFilters(rawList, filters, region, datePostedOverride) {
  const workplaces = normalizeFilterList(filters.workplace, ["Remote", "Hybrid", "On-site"]);
  const jobTypes = normalizeFilterList(filters.jobType, ["Full-time", "Part-time"]);
  const filterAnnual = filterSalaryToAnnualRange(filters, region);
  const dateKey = datePostedOverride || filters.datePosted;
  const { maxAgeHours } = resolveJSearchDatePosted(dateKey);

  let jobs = rawList
    .filter((job) => isJobWithinMaxAge(job.job_posted_at_datetime_utc, maxAgeHours))
    .filter((job) => cityMatchesSelection(job, filters.cities))
    .filter((job) => jobMatchesSalaryFilter(job, filterAnnual, region))
    .filter((job) => matchesJobTypeFilter(job, jobTypes))
    .map((job, index) => mapJSearchJob(job, index, region))
    .filter((job) => matchesWorkplaceFilter(job, workplaces));

  if (jobs.length === 0 && rawList.length > 0) {
    console.warn(`Salary/workplace filters removed all ${rawList.length} jobs; returning unfiltered mapped list`);
    jobs = rawList
      .filter((job) => cityMatchesSelection(job, filters.cities))
      .filter((job) => matchesJobTypeFilter(job, jobTypes))
      .map((job, index) => mapJSearchJob(job, index, region))
      .filter((job) => matchesWorkplaceFilter(job, workplaces));
  }

  if (jobs.length === 0 && rawList.length > 0) {
    jobs = rawList
      .filter((job) => isJobWithinMaxAge(job.job_posted_at_datetime_utc, maxAgeHours))
      .filter((job) => cityMatchesSelection(job, filters.cities))
      .map((job, index) => mapJSearchJob(job, index, region));
  }

  return sortJobsNewestFirst(jobs);
}

async function fetchJSearchJobs(profile, filters, apiKey, options = {}) {
  const { apiPage = 1, numPages = JSEARCH_INITIAL_PAGES, fixedQuery = null } = options;
  const region = REGION_MAP[filters.region?.label] || REGION_MAP["United States"];

  const queries = fixedQuery ? [fixedQuery] : buildSearchQueryVariants(profile);
  const seen = new Set();
  let rawList = [];
  let primaryQuery = queries[0];

  for (const query of queries) {
    if (!fixedQuery && rawList.length >= MIN_JOBS_TARGET) break;

    const batch = await requestJSearchRaw(query, filters, region, apiKey, { apiPage, numPages });
    console.log(`JSearch "${query}": ${batch.length} raw (page ${apiPage}, num_pages ${numPages})`);

    for (const job of batch) {
      const id = job.job_id || `${job.job_title}-${job.employer_name}-${job.job_city}`;
      if (!seen.has(id)) {
        seen.add(id);
        rawList.push(job);
      }
    }

    if (!primaryQuery || batch.length > 0) primaryQuery = query;
    if (fixedQuery) break;
    if (batch.length >= JSEARCH_PAGE_SIZE) break;
  }

  const selectedCities = Array.isArray(filters.cities) ? filters.cities.filter(Boolean) : [];
  if (!fixedQuery && selectedCities.length > 1 && rawList.length < MIN_JOBS_TARGET) {
    for (const city of selectedCities.slice(0, 4)) {
      if (rawList.length >= MIN_JOBS_TARGET) break;
      const cityFilters = { ...filters, cities: [city] };
      for (const query of queries.slice(0, 2)) {
        const batch = await requestJSearchRaw(query, cityFilters, region, apiKey, { apiPage, numPages });
        for (const job of batch) {
          const id = job.job_id || `${job.job_title}-${job.employer_name}-${job.job_city}`;
          if (!seen.has(id)) {
            seen.add(id);
            rawList.push(job);
          }
        }
        if (batch.length >= JSEARCH_PAGE_SIZE) break;
      }
    }
  }

  const requestedDate = filters.datePosted || "week";
  const dateMeta = resolveJSearchDatePosted(requestedDate);
  let jobs = applyJobFilters(rawList, filters, region);
  let datePostedEffective = requestedDate;
  let datePostedNotice = null;

  // Avoid empty results on "last 24h" — widen window and tell the user.
  if (!fixedQuery && jobs.length < MIN_JOBS_AFTER_DATE_FILTER && dateMeta.fallback) {
    const widerJobs = applyJobFilters(rawList, filters, region, dateMeta.fallback);
    if (widerJobs.length > jobs.length) {
      jobs = widerJobs;
      datePostedEffective = dateMeta.fallback;
      if (dateMeta.requested === "24h") {
        datePostedNotice =
          "No jobs were posted in the last 24 hours for this search. Showing matches from the past week instead (newest first).";
      } else if (dateMeta.requested === "week") {
        datePostedNotice =
          "Few jobs matched the past week. Showing matches from the past month instead (newest first).";
      }
    }
  }

  // Still empty: one extra API pass with a broader date_posted window.
  if (!fixedQuery && jobs.length < MIN_JOBS_AFTER_DATE_FILTER) {
    const monthFilters = { ...filters, datePosted: "month" };
    const seenMonth = new Set(seen);
    for (const query of queries.slice(0, 2)) {
      const batch = await requestJSearchRaw(query, monthFilters, region, apiKey, { apiPage, numPages });
      for (const job of batch) {
        const id = job.job_id || `${job.job_title}-${job.employer_name}-${job.job_city}`;
        if (!seenMonth.has(id)) {
          seenMonth.add(id);
          rawList.push(job);
        }
      }
    }
    const monthJobs = applyJobFilters(rawList, monthFilters, region);
    if (monthJobs.length > jobs.length) {
      jobs = monthJobs;
      datePostedEffective = "month";
      if (!datePostedNotice) {
        datePostedNotice =
          "Very few recent listings. Showing matches from the past month instead (newest first).";
      }
    }
  }

  const expectedBatch = numPages * JSEARCH_PAGE_SIZE;
  const hasMoreApi = rawList.length >= expectedBatch - 2;

  console.log(
    `JSearch total: ${rawList.length} raw → ${jobs.length} after filters (date=${datePostedEffective}, queries=${queries.join(" | ")})`
  );

  return {
    jobs,
    region,
    query: primaryQuery,
    hasMoreApi,
    apiPage,
    numPages,
    datePostedEffective,
    datePostedNotice,
    jsearchStats: {
      rawCount: rawList.length,
      afterFilters: jobs.length,
      queries: queries.slice(0, MAX_QUERY_VARIANTS),
    },
  };
}

function basicMatchScore(job, profile) {
  const skills = [
    ...(profile.skills || []),
    ...(profile.technologies || []),
    ...(profile.frameworks || []),
    ...(profile.programming_languages || []),
  ].map((s) => String(s).toLowerCase());
  const text = `${job.title} ${job.description}`.toLowerCase();
  const titleWords = (profile.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  let hits = 0;
  skills.forEach((s) => {
    if (s && text.includes(s)) hits += 1;
  });
  titleWords.forEach((w) => {
    if (text.includes(w)) hits += 1;
  });
  return Math.min(92, 35 + hits * 10);
}

async function scoreJobBatchWithAI(batch, profile, apiKey, userId) {
  const anthropic = getAnthropic(apiKey);
  const jobSummaries = batch.map((j, i) => ({
    index: i,
    title: j.title,
    company: j.company,
    description: j.description?.slice(0, 400),
  }));

  const profileSkills = [
    ...(profile.skills || []),
    ...(profile.technologies || []),
    ...(profile.frameworks || []),
    ...(profile.programming_languages || []),
  ]
    .filter(Boolean)
    .slice(0, 20)
    .join(", ");

  const response = await createAnthropicMessage(
    anthropic,
    {
      model: MODEL,
      max_tokens: 1200,
      system:
        "You rank job matches. Return ONLY valid JSON array: [{\"index\":0,\"match_score\":85}] with one entry per job index and match_score 0-100. Score generously when skills and title align; 70+ means reasonable fit, 85+ strong fit.",
      messages: [
        {
          role: "user",
          content: `Candidate: ${profile.title}, ${profile.experience_years || 0} years, seniority: ${profile.seniority || "unknown"}. Skills: ${profileSkills || "not listed"}.\nJobs:\n${JSON.stringify(jobSummaries)}`,
        },
      ],
    },
    { action: "scoreJobs", userId }
  );

  const text = response.content[0].text.replace(/```json|```/g, "").trim();
  const jsonSlice = text.match(/\[[\s\S]*\]/)?.[0] || text;
  const scores = JSON.parse(jsonSlice);
  const scoreMap = {};
  scores.forEach((s) => {
    if (typeof s.index === "number") {
      scoreMap[s.index] = Math.min(100, Math.max(0, s.match_score));
    }
  });

  return batch.map((j, i) => ({
    ...j,
    match_score: scoreMap[i] ?? basicMatchScore(j, profile),
  }));
}

/** Score every job returned (batched AI calls). Never truncate the list. */
async function scoreJobsWithAI(jobs, profile, isFree, apiKey, userId) {
  if (jobs.length === 0) return [];

  const scored = jobs.map((j) => ({ ...j, match_score: basicMatchScore(j, profile) }));
  const maxAiJobs = isFree ? 30 : jobs.length;

  for (let start = 0; start < Math.min(jobs.length, maxAiJobs); start += AI_SCORE_BATCH_SIZE) {
    const batch = jobs.slice(start, start + AI_SCORE_BATCH_SIZE);
    try {
      const aiScored = await scoreJobBatchWithAI(batch, profile, apiKey, userId);
      aiScored.forEach((job, i) => {
        scored[start + i] = job;
      });
    } catch (err) {
      console.warn(`AI scoring batch at ${start} failed, using heuristic scores:`, err.message);
    }
  }

  return sortJobsNewestFirst(scored);
}

function parseJsonFromAI(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error("Invalid JSON from AI");
  }
}

function verifyRazorpayWebhookSignature(rawBody, signatureHeader, secret) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = String(signatureHeader || "");
  if (!received || expected.length !== received.length) {
    throw new Error("Invalid webhook signature");
  }
  if (!crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"))) {
    throw new Error("Invalid webhook signature");
  }
}

function verifyRazorpayPaymentSignature({ subscriptionId, paymentId, signature, secret }) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${subscriptionId}|${paymentId}`)
    .digest("hex");
  if (expected !== signature) {
    throw new HttpsError("invalid-argument", "Invalid payment signature.");
  }
}

function resolveCheckoutPlanId(plan, weeklyId, monthlyId) {
  const key = String(plan || "monthly").toLowerCase();
  if (key === "weekly" || key === "week") return { planId: weeklyId, planKey: "weekly" };
  if (key === "monthly" || key === "month") return { planId: monthlyId, planKey: "monthly" };
  throw new HttpsError("invalid-argument", 'Plan must be "weekly" or "monthly".');
}

function razorpayAuthHeader(keyId, keySecret) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayRequest(keyId, keySecret, path, options = {}) {
  const response = await fetch(`${RZ_API}${path}`, {
    ...options,
    headers: {
      Authorization: razorpayAuthHeader(keyId, keySecret),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Razorpay API error:", path, json);
    throw new Error(json.error?.description || json.error?.code || "Razorpay request failed");
  }
  return json;
}

async function createRazorpaySubscription({ userId, email, keyId, keySecret, planId, planKey }) {
  const subscription = await razorpayRequest(keyId, keySecret, "/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: RZ_SUBSCRIPTION_TOTAL_COUNT,
      quantity: 1,
      customer_notify: 1,
      notes: {
        user_id: userId,
        plan: planKey,
        email: email || "",
      },
    }),
  });

  if (!subscription?.id) {
    throw new Error("No subscription ID returned from Razorpay");
  }
  return subscription;
}

async function sendGa4Event({ userId, eventName, params = {} }) {
  const measurementId = ga4MeasurementId.value();
  const apiSecret = ga4ApiSecret.value();
  if (!measurementId || !apiSecret) return;

  const safeParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "number" || typeof v === "boolean") safeParams[k] = v;
    else safeParams[k] = String(v).slice(0, 100);
  }
  safeParams.engagement_time_msec = safeParams.engagement_time_msec || 1;

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: userId,
          user_id: userId,
          events: [{ name: String(eventName).slice(0, 40), params: safeParams }],
        }),
      }
    );
    if (!response.ok) {
      console.warn("GA4 MP event failed:", eventName, response.status);
    }
  } catch (err) {
    console.warn("GA4 MP send error:", err.message);
  }
}

async function setUserPro(userId, subscriptionId, planKey = "monthly") {
  await db.collection("users").doc(userId).update({
    tier: "pro",
    razorpaySubscriptionId: subscriptionId || null,
    proPlan: planKey || "monthly",
    upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function setUserFree(userId) {
  await db.collection("users").doc(userId).update({
    tier: "free",
    razorpaySubscriptionId: null,
    proPlan: null,
    proExpiresAt: null,
  });
}

// ─── Callable: Get User Profile ──────────────────────────────────────────────

exports.getUserProfile = onCall(BASE_OPTS, async (request) => {
  const user = await ensureUserExists(request);
  const resumeText = await resolveResumeTextForUser(user.id, user);
  return serializeUserForClient(user, {
    hasStoredResumeText: resumeText.length >= 50 || user.hasStoredResumeText === true,
  });
});

// ─── Callable: Parse Resume (server-side AI — key never exposed) ─────────────

exports.parseResume = onCall(
  { ...AI_OPTS, timeoutSeconds: 90 },
  async (request) => {
    const user = await ensureUserExists(request);
    const userId = user.id;
    const { text: resumeText, source, fileName } = await extractResumeText(request.data || {});

    const isFree = user.tier !== "pro";

    if (isFree) {
      const uploads = resetMonthlyCounter(user.resumeUploads);
      if (uploads.count >= 1) {
        throw new HttpsError(
          "resource-exhausted",
          "FREE_LIMIT:upload: Free tier includes 1 resume upload per month. Upgrade to Pro for unlimited uploads and updates."
        );
      }
    }

    await checkRateLimit(userId, "parseResume");

    const anthropic = getAnthropic(anthropicApiKey.value());

    const response = await createAnthropicMessage(
      anthropic,
      {
        model: MODEL,
        max_tokens: 800,
        system:
          'Parse resumes. Return ONLY JSON: {"name":"string","title":"string","job_titles":["string"],"experience_years":number,"seniority":"Junior|Mid-Level|Senior|Lead|string","skills":["skill1"],"technologies":["tech"],"frameworks":["framework"],"programming_languages":["lang"],"industry":"string or empty","location_preference":"string or empty","summary":"string","top_strength":"string","email":"string or empty","phone":"string or empty","location":"string or empty","linkedin":"url or empty","github":"url or empty","portfolio":"url or empty","website":"url or empty"}. Extract job titles, skills, tech stack, seniority, industry, and location preferences. Use empty string or empty array when missing.',
        messages: [{ role: "user", content: `Parse this resume:\n"""${resumeText}"""` }],
      },
      { action: "parseResume", userId }
    );

    let parsed;
    try {
      parsed = parseJsonFromAI(response.content[0].text);
      if (!parsed.job_titles?.length && parsed.title) {
        parsed.job_titles = [parsed.title];
      }
    } catch {
      throw new HttpsError("internal", "Could not parse resume. Please try again.");
    }

    const storedResumeText = sanitizeText(resumeText, MAX_RESUME_CHARS);

    const resumeDoc = await db.collection("users").doc(userId).collection("resumes").add({
      parsed,
      resumeText: storedResumeText,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      textLength: storedResumeText.length,
      source,
      fileName,
    });

    const profileUpdate = {
      parsedProfile: parsed,
      parsedProfileUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      latestResumeId: resumeDoc.id,
      hasStoredResumeText: true,
    };

    if (isFree) {
      const uploads = resetMonthlyCounter((await getUser(userId)).resumeUploads);
      uploads.count += 1;
      profileUpdate.resumeUploads = uploads;
    }

    await db.collection("users").doc(userId).update(profileUpdate);

    return { success: true, parsed, resumeId: resumeDoc.id, source };
  }
);

// ─── Callable: Search Jobs (JSearch + AI ranking) ────────────────────────────

exports.searchJobs = onCall(
  { ...AI_OPTS, timeoutSeconds: 180 },
  async (request) => {
    const user = await ensureUserExists(request);
    const userId = user.id;
    const { profile, filters, apiPage = 1, paginateOnly = false } = request.data || {};

    if (!profile?.title) {
      throw new HttpsError("invalid-argument", "Upload your resume first.");
    }

    const isFree = user.tier !== "pro";
    const pageNum = Math.max(1, Math.min(20, Number(apiPage) || 1));
    const isLoadMore = paginateOnly === true;

    if (isFree && !isLoadMore) {
      const searches = resetMonthlyCounter(user.searches);
      if (searches.count >= 1) {
        return {
          error: "Limit reached",
          message: "FREE_LIMIT:search: Free plan includes 1 job search per month. Upgrade to Pro for unlimited searches.",
          tier: "free",
          searchesRemaining: 0,
        };
      }
    }

    await checkRateLimit(userId, isLoadMore ? "searchJobsPage" : "searchJobs");

    const enrichedFilters = {
      ...filters,
      currency: REGION_MAP[filters?.region?.label]?.currency
        ? {
            code: REGION_MAP[filters.region.label].currency,
            symbol: REGION_MAP[filters.region.label].symbol,
          }
        : { code: "USD", symbol: "$" },
    };

    const fetchOpts = isLoadMore
      ? {
          apiPage: pageNum,
          numPages: 1,
          fixedQuery: user.lastJobSearch?.query || cleanJobTitle(profile.title),
        }
      : { apiPage: 1, numPages: JSEARCH_INITIAL_PAGES };

    const {
      jobs: rawJobs,
      region,
      query,
      hasMoreApi,
      apiPage: fetchedPage,
      datePostedEffective,
      datePostedNotice,
      jsearchStats,
      searchStats,
    } = isLoadMore
      ? await fetchJSearchJobs(profile, enrichedFilters, rapidApiKey.value(), fetchOpts).then((r) => ({
          ...r,
          searchStats: r.jsearchStats
            ? { ...r.jsearchStats, byProvider: { jsearch: r.jobs?.length || 0, jooble: 0, adzuna: 0 } }
            : null,
        }))
      : await runMultiSourceSearch({
          profile,
          filters: enrichedFilters,
          userId,
          db,
          fetchJSearchJobs,
          keys: {
            rapidApiKey: rapidApiKey.value(),
            joobleApiKey: joobleApiKey.value(),
            adzunaAppId: adzunaAppId.value(),
            adzunaAppKey: adzunaAppKey.value(),
          },
          options: fetchOpts,
        });

    let jobs = isLoadMore
      ? scoreJobsForProfile(
          applyExperienceLevelFilter(
            applySourceFilter(rawJobs || [], enrichedFilters.sources),
            enrichedFilters.experienceLevel
          ),
          profile,
          enrichedFilters
        )
      : rawJobs || [];

    if (jobs.length > 0) {
      jobs = await scoreJobsWithAI(jobs, profile, isFree, anthropicApiKey.value(), userId);
    }
    const hasResults = jobs.length >= MIN_JOBS_TO_COUNT_FREE_SEARCH;

    // Free search counts only when the user gets job listings back.
    if (!isLoadMore && isFree && !hasResults) {
      const currentUser = await getUser(userId);
      const searchesRemaining = Math.max(
        0,
        1 - resetMonthlyCounter(currentUser.searches).count
      );
      return {
        success: false,
        insufficientResults: true,
        error: "Insufficient results",
        message:
          "No jobs matched these filters. Your free search wasn't used — try fewer cities, a broader country, workplace, or salary range.",
        jobs: [],
        total: 0,
        apiPage: fetchedPage || pageNum,
        nextApiPage: (fetchedPage || pageNum) + (fetchOpts.numPages || 1),
        hasMoreApi,
        paginateOnly: false,
        tier: user.tier,
        searchesRemaining,
        searchCounted: false,
        currency: region,
        datePostedEffective,
        datePostedNotice: datePostedNotice || null,
        jsearchStats: jsearchStats || null,
      };
    }

    if (!isLoadMore && hasResults) {
      await db.collection("searches").doc(userId).collection("history").add({
        jobCount: jobs.length,
        filters: enrichedFilters,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        source: "multi_source",
      });

      await db.collection("users").doc(userId).update({
        lastJobSearch: {
          query,
          filters: enrichedFilters,
          profileTitle: profile.title,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastApiPage: fetchedPage,
        },
      });

      if (isFree) {
        const searches = resetMonthlyCounter((await getUser(userId)).searches);
        searches.count += 1;
        await db.collection("users").doc(userId).update({ searches });
      }
    }

    const updatedUser = await getUser(userId);
    const searchesRemaining = isFree
      ? Math.max(0, 1 - (resetMonthlyCounter(updatedUser.searches).count))
      : "unlimited";

    const nextApiPage = (fetchedPage || pageNum) + (fetchOpts.numPages || 1);

    return {
      success: true,
      jobs,
      total: jobs.length,
      apiPage: fetchedPage || pageNum,
      nextApiPage,
      hasMoreApi,
      paginateOnly: isLoadMore,
      tier: user.tier,
      searchesRemaining,
      searchCounted: !isLoadMore && hasResults && isFree,
      currency: region,
      datePostedEffective,
      datePostedNotice: datePostedNotice || null,
      jsearchStats: jsearchStats || null,
      searchStats: searchStats || null,
    };
  }
);

// ─── Callable: Generate Document ─────────────────────────────────────────────

exports.generateDocument = onCall(
  { ...AI_OPTS, timeoutSeconds: 180 },
  async (request) => {
    const user = await ensureUserExists(request);
    const userId = user.id;
    const { job, profile: clientProfile, documentType } = request.data || {};

    const validTypes = ["resume", "cover_letter", "cold_email"];
    if (!validTypes.includes(documentType)) {
      throw new HttpsError("invalid-argument", "Invalid document type.");
    }
    if (!job?.title) {
      throw new HttpsError("invalid-argument", "Missing job data.");
    }

    const profile = user.parsedProfile || clientProfile;
    if (!profile?.name && !profile?.title) {
      throw new HttpsError("invalid-argument", "Upload your resume first.");
    }

    const isFree = user.tier !== "pro";
    const kitKey = sanitizeKitKey(job);
    const monthlyKit = resetApplicationKit(user.applicationKit);

    if (isFree && hasUsedFreeGeneration(monthlyKit)) {
      throw new HttpsError(
        "resource-exhausted",
        "FREE_KIT_USED: You've used your free generation for this month. Upgrade to Pro for unlimited generations and regenerate."
      );
    }

    await checkRateLimit(userId, "generateDocument");

    const resumeText = await resolveResumeTextForUser(userId, user);
    const needsResumeReupload = resumeText.length < 50;
    if (needsResumeReupload) {
      console.warn(`generateDocument: no stored resume text for user ${userId}`);
    }

    const contextBlock = buildGenerationContext(profile, resumeText, job);
    const promptSpec = buildDocumentPrompts(documentType, contextBlock, profile);

    const anthropic = getAnthropic(anthropicApiKey.value());

    const response = await createAnthropicMessage(
      anthropic,
      {
        model: MODEL,
        max_tokens: promptSpec.maxTokens,
        system: promptSpec.system,
        messages: [{ role: "user", content: promptSpec.user }],
      },
      { action: `generateDocument:${documentType}`, userId }
    );

    let content = response.content[0].text;
    if (documentType === "resume") {
      content = normalizeResumeOutput(content);
    }

    await saveJobKitDocument(userId, job, documentType, content);

    await db.collection("users").doc(userId).collection("documents").add({
      kitKey,
      jobId: kitKey,
      jobTitle: job.title,
      company: job.company,
      documentType,
      contentLength: content.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      model: MODEL,
      usedResumeText: resumeText.length >= 50,
    });

    if (isFree) {
      const kit = resetApplicationKit((await getUser(userId)).applicationKit);
      kit.kitKey = kit.kitKey || kitKey;
      kit.jobId = kit.jobId || kitKey;
      kit[documentType] = true;
      if (kit.resume && kit.cover_letter && kit.cold_email) {
        kit.complete = true;
      }
      await db.collection("users").doc(userId).update({ applicationKit: kit });
    }

    return {
      success: true,
      content,
      documentType,
      kitKey,
      needsResumeReupload,
      usedResumeText: resumeText.length >= 50,
    };
  }
);

// ─── Callable: Get saved application kit for a job ───────────────────────────

exports.getJobKit = onCall(BASE_OPTS, async (request) => {
  const user = await ensureUserExists(request);
  const { job, kitKey: kitKeyArg } = request.data || {};

  if (!kitKeyArg && !job?.title && !job?.id && !(job?.company && job?.title)) {
    throw new HttpsError("invalid-argument", "Missing kit identifier.");
  }

  const resolvedKey = kitKeyArg || (await resolveKitKey(user.id, { kitKey: kitKeyArg, job }));
  const kit = await loadJobKit(user.id, { kitKey: resolvedKey, job });
  const updatedAt =
    kit.updatedAt instanceof admin.firestore.Timestamp
      ? kit.updatedAt.toDate().toISOString()
      : kit.updatedAt?.toDate?.()?.toISOString?.() || null;

  return {
    success: true,
    kitKey: kit.kitKey || resolvedKey || sanitizeKitKey(job || {}),
    jobId: kit.jobId || resolvedKey,
    jobTitle: kit.jobTitle || job?.title || "",
    company: kit.company || job?.company || "",
    location: kit.location || "",
    workplace: kit.workplace || "",
    posted: kit.posted || "",
    applyUrl: kit.applyUrl || "",
    jobSnapshot: kit.jobSnapshot,
    kit: {
      resume: kit.resume,
      cover_letter: kit.cover_letter,
      cold_email: kit.cold_email,
    },
    updatedAt,
    hasKit: Boolean(kit.resume || kit.cover_letter || kit.cold_email),
  };
});

// ─── Callable: List all saved application kits ───────────────────────────────

exports.listJobKits = onCall(BASE_OPTS, async (request) => {
  const user = await ensureUserExists(request);
  const snap = await db
    .collection("users")
    .doc(user.id)
    .collection("jobKits")
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();

  const kits = snap.docs.map((doc) => {
    const d = doc.data();
    const snapshot = d.jobSnapshot || {};
    const updatedAt =
      d.updatedAt instanceof admin.firestore.Timestamp
        ? d.updatedAt.toDate().toISOString()
        : d.updatedAt?.toDate?.()?.toISOString?.() || null;
    return {
      kitKey: d.kitKey || doc.id,
      jobKey: doc.id,
      jobId: d.jobId || snapshot.originalJobId || doc.id,
      jobTitle: d.jobTitle || snapshot.title || "Untitled role",
      company: d.company || snapshot.company || "",
      location: d.location || snapshot.location || "",
      workplace: d.workplace || snapshot.workplace || "",
      posted: d.posted || snapshot.posted || "",
      applyUrl: d.applyUrl || snapshot.apply_url || "",
      updatedAt,
      hasResume: Boolean(d.resume),
      hasCoverLetter: Boolean(d.cover_letter),
      hasEmail: Boolean(d.cold_email),
    };
  });

  return { success: true, kits };
});

// ─── Callable: Razorpay Checkout (USD display; INR plans in Razorpay dashboard) ─

exports.createCheckoutSession = onCall(CHECKOUT_OPTS, async (request) => {
  const user = await ensureUserExists(request);
  const userId = user.id;
  const { plan } = request.data || {};

  try {
    const keyId = rzKeyId.value();
    const keySecret = rzKeySecret.value();
    const { planId, planKey } = resolveCheckoutPlanId(
      plan,
      rzPlanIdWeekly.value(),
      rzPlanIdMonthly.value()
    );

    const subscription = await createRazorpaySubscription({
      userId,
      email: user.email,
      keyId,
      keySecret,
      planId,
      planKey,
    });

    await recordBillingEvent(userId, {
      status: "started",
      plan: planKey,
      subscriptionId: subscription.id,
    });

    const isWeekly = planKey === "weekly";
    return {
      keyId,
      subscriptionId: subscription.id,
      plan: planKey,
      email: user.email || "",
      customerName: user.name || "",
      name: "NextOffer.ai",
      description: isWeekly ? "Weekly Sprint — Pro" : "Monthly Pro",
      amountLabel: isWeekly ? "$5.99/week" : "$9.99/month",
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Checkout error:", error.message);
    throw new HttpsError("internal", "Could not start checkout. Please try again.");
  }
});

exports.verifyRazorpaySubscription = onCall(
  { ...BASE_OPTS, secrets: [rzKeySecret] },
  async (request) => {
    const userId = requireAuth(request);
    const {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
      plan,
    } = request.data || {};

    if (!paymentId || !subscriptionId || !signature) {
      throw new HttpsError("invalid-argument", "Missing payment verification fields.");
    }

    verifyRazorpayPaymentSignature({
      subscriptionId,
      paymentId,
      signature,
      secret: rzKeySecret.value(),
    });

    const planKey = String(plan || "monthly").toLowerCase();
    await setUserPro(userId, subscriptionId, planKey);
    await recordBillingEvent(userId, {
      status: "completed",
      plan: planKey,
      subscriptionId,
    });

    const isWeekly = planKey === "weekly" || planKey === "week";
    await sendGa4Event({
      userId,
      eventName: "purchase_success",
      params: {
        plan: isWeekly ? "weekly" : "monthly",
        value: isWeekly ? PRO_PRICE_USD.weekly : PRO_PRICE_USD.monthly,
        currency: "USD",
      },
    });

    return { success: true, tier: "pro" };
  }
);

// ─── HTTP: Razorpay Webhook ──────────────────────────────────────────────────

exports.razorpayWebhook = onRequest(RZ_WEBHOOK_OPTS, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    res.status(400).send("Missing raw body");
    return;
  }

  try {
    verifyRazorpayWebhookSignature(
      rawBody,
      req.headers["x-razorpay-signature"],
      rzWebhookSecret.value()
    );
  } catch (err) {
    console.error("Razorpay webhook signature failed:", err.message);
    res.status(401).send("Invalid signature");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).send("Invalid JSON");
    return;
  }

  const eventName = payload.event;
  const subEntity = payload.payload?.subscription?.entity || null;
  const paymentEntity = payload.payload?.payment?.entity || null;
  const entity = subEntity || paymentEntity || {};
  const notes = subEntity?.notes || paymentEntity?.notes || entity.notes || {};
  const userId = notes.user_id;
  const planKey = String(notes.plan || "monthly").toLowerCase();
  const subscriptionId = subEntity?.id || paymentEntity?.subscription_id || entity.id;

  try {
    if (!userId) {
      res.json({ received: true, skipped: "no user_id in notes" });
      return;
    }

    const activateEvents = new Set([
      "subscription.authenticated",
      "subscription.activated",
      "subscription.charged",
      "subscription.resumed",
    ]);
    const deactivateEvents = new Set([
      "subscription.cancelled",
      "subscription.completed",
      "subscription.halted",
    ]);

    if (activateEvents.has(eventName)) {
      await setUserPro(userId, subscriptionId, planKey);
      if (eventName === "subscription.charged" || eventName === "subscription.activated") {
        const isWeekly = planKey === "weekly" || planKey === "week";
        await sendGa4Event({
          userId,
          eventName: "purchase_success",
          params: {
            plan: isWeekly ? "weekly" : "monthly",
            value: isWeekly ? PRO_PRICE_USD.weekly : PRO_PRICE_USD.monthly,
            currency: "USD",
          },
        });
      }
    }

    if (deactivateEvents.has(eventName)) {
      await setUserFree(userId);
    }
  } catch (err) {
    console.error("Razorpay webhook handler error:", err);
    res.status(500).send("Webhook handler failed");
    return;
  }

  res.json({ received: true });
});

// ─── Callable: Log client errors (web crash reporting) ───────────────────────

exports.logClientError = onCall(BASE_OPTS, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};

  const message = sanitizeText(data.message, 500);
  const stack = sanitizeText(data.stack, 4000);
  const source = sanitizeText(data.source, 64);
  const screen = sanitizeText(data.screen, 64);
  const action = sanitizeText(data.action, 64);
  const url = sanitizeText(data.url, 256);
  const userAgent = sanitizeText(data.userAgent, 256);
  const fatal = Boolean(data.fatal);

  if (!message && !stack) {
    throw new HttpsError("invalid-argument", "Error message or stack required.");
  }

  const hourAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const recentSnap = await db
    .collection("clientErrors")
    .where("uid", "==", uid)
    .where("createdAt", ">", hourAgo)
    .limit(31)
    .get();

  if (recentSnap.size >= 30) {
    return { success: true, skipped: "rate_limited" };
  }

  await db.collection("clientErrors").add({
    uid,
    message,
    stack,
    source,
    screen,
    action,
    url,
    userAgent,
    fatal,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── Callable: Delete user data (resume or full account) ─────────────────────

exports.analyzeLinkedIn = onCall({ ...AI_OPTS, timeoutSeconds: 120 }, async (request) => {
    const user = await ensureUserExists(request);
    const userId = user.id;

    requireProTier(user, "LinkedIn optimiser");

    if (!request.data?.linkedinPdfBase64 && !request.data?.linkedinProfileText) {
      throw new HttpsError("invalid-argument", "Upload a LinkedIn profile PDF export or paste profile text.");
    }

    await checkRateLimit(userId, "analyzeLinkedIn");

    const { text, fileName } = await extractResumeText(request.data || {});
    if (text.length < 80) {
      console.warn(`LinkedIn analysis: short extract (${text.length} chars) for user ${userId}`);
    }
    const anthropic = getAnthropic(anthropicApiKey.value());

    let analysis;
    try {
      const result = await runLinkedInAnalysis(
        (params) =>
          createAnthropicMessage(anthropic, { model: MODEL, ...params }, { action: "analyzeLinkedIn", userId }),
        text
      );
      analysis = result.analysis;
    } catch (err) {
      console.error("LinkedIn analysis failed:", err.message, {
        textLength: text.length,
        stopReason: err.stopReason,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        "internal",
        "Could not analyse LinkedIn profile. Try pasting profile text instead of PDF, or try again in a minute."
      );
    }

    const analyzedAt = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection("users").doc(userId).collection("linkedinAnalyses").add({
      analysis,
      profileText: text.slice(0, MAX_RESUME_CHARS),
      fileName: fileName || request.data?.fileName || "linkedin.pdf",
      analyzedAt,
      textLength: text.length,
      sectionGenerations: {},
    });

    const profileUpdate = {
      latestLinkedInAnalysisId: docRef.id,
      linkedinAnalysisUpdatedAt: analyzedAt,
    };

    await db.collection("users").doc(userId).update(profileUpdate);

    return {
      success: true,
      analysis,
      analysisId: docRef.id,
      fileName: fileName || request.data?.fileName || "linkedin.pdf",
      analyzedAt: new Date().toISOString(),
    };
});

exports.getLinkedInAnalysis = onCall(BASE_OPTS, async (request) => {
  const user = await ensureUserExists(request);
  requireProTier(user, "LinkedIn optimiser");
  const userId = user.id;

  if (user.latestLinkedInAnalysisId) {
    const doc = await db
      .collection("users")
      .doc(userId)
      .collection("linkedinAnalyses")
      .doc(user.latestLinkedInAnalysisId)
      .get();
    if (doc.exists) {
      const data = doc.data();
      const ts = data.analyzedAt?.toDate?.();
      return {
        analysis: data.analysis,
        fileName: data.fileName || "",
        analyzedAt: ts ? ts.toISOString() : null,
        analysisId: doc.id,
        sectionGenerations: serializeLinkedInSectionGenerations(data.sectionGenerations),
        hasProfileText: Boolean(data.profileText && data.profileText.length >= 50),
      };
    }
  }

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("linkedinAnalyses")
    .limit(20)
    .get();

  if (snap.empty) {
    return { analysis: null };
  }

  const docs = snap.docs
    .map((doc) => ({ doc, data: doc.data() }))
    .sort((a, b) => {
      const ta = a.data.analyzedAt?.toMillis?.() || 0;
      const tb = b.data.analyzedAt?.toMillis?.() || 0;
      return tb - ta;
    });

  const doc = docs[0].doc;
  const data = docs[0].data;
  const ts = data.analyzedAt?.toDate?.();
  return {
    analysis: data.analysis,
    fileName: data.fileName || "",
    analyzedAt: ts ? ts.toISOString() : null,
    analysisId: doc.id,
    sectionGenerations: serializeLinkedInSectionGenerations(data.sectionGenerations),
    hasProfileText: Boolean(data.profileText && data.profileText.length >= 50),
  };
});

function serializeLinkedInSectionGenerations(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [sectionId, entry] of Object.entries(raw)) {
    if (!entry?.content) continue;
    const ts = entry.generatedAt?.toDate?.();
    out[sectionId] = {
      content: String(entry.content),
      generatedAt: ts ? ts.toISOString() : null,
    };
  }
  return out;
}

exports.generateLinkedInSection = onCall({ ...AI_OPTS, timeoutSeconds: 90 }, async (request) => {
  const user = await ensureUserExists(request);
  requireProTier(user, "LinkedIn optimiser");
  const userId = user.id;
  const { analysisId, sectionId } = request.data || {};

  if (!analysisId || !sectionId) {
    throw new HttpsError("invalid-argument", "Missing analysis or section.");
  }
  if (!GENERATABLE_SECTION_IDS.includes(sectionId)) {
    throw new HttpsError("invalid-argument", "This section does not support content generation.");
  }

  const analysisRef = db.collection("users").doc(userId).collection("linkedinAnalyses").doc(analysisId);
  const analysisDoc = await analysisRef.get();
  if (!analysisDoc.exists) {
    throw new HttpsError("not-found", "LinkedIn analysis not found. Run a new analysis first.");
  }

  const analysisData = analysisDoc.data();
  const section = (analysisData.analysis?.sections || []).find((s) => s.id === sectionId);
  if (!section) {
    throw new HttpsError("not-found", "Section not found in this analysis.");
  }

  await checkRateLimit(userId, "generateLinkedInSection");

  let profileText = sanitizeText(analysisData.profileText, MAX_GENERATION_RESUME_CHARS);
  if (profileText.length < 50) {
    profileText = sanitizeText(await resolveResumeTextForUser(userId, user), MAX_GENERATION_RESUME_CHARS);
  }

  const parsedProfile = user.parsedProfile || null;
  const anthropic = getAnthropic(anthropicApiKey.value());

  let content;
  try {
    content = await generateLinkedInSectionContent(
      (params) =>
        createAnthropicMessage(anthropic, { model: MODEL, ...params }, {
          action: "generateLinkedInSection",
          userId,
        }),
      { sectionId, section, profileText, parsedProfile }
    );
  } catch (err) {
    console.error("LinkedIn section generation failed:", err.message, { sectionId, userId });
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Could not generate content for this section. Please try again.");
  }

  const generatedAt = admin.firestore.FieldValue.serverTimestamp();
  await analysisRef.update({
    [`sectionGenerations.${sectionId}`]: { content, generatedAt },
  });

  return {
    success: true,
    sectionId,
    content,
    generatedAt: new Date().toISOString(),
    usedProfileText: profileText.length >= 50,
  };
});

exports.recordCheckoutOutcome = onCall(BASE_OPTS, async (request) => {
  const userId = requireAuth(request);
  const { status, plan, subscriptionId, note } = request.data || {};
  const allowed = ["dismissed", "failed"];
  if (!allowed.includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid checkout status.");
  }
  await recordBillingEvent(userId, {
    status,
    plan: plan || null,
    subscriptionId: subscriptionId || null,
    note: note ? String(note).slice(0, 200) : null,
  });
  return { success: true };
});

exports.adminLogin = onCall(BASE_OPTS, async (request) => {
  const { email, password } = request.data || {};
  if (!validateAdminCredentials(email, password, adminEmails.value(), adminPassword.value())) {
    throw new HttpsError("permission-denied", "Invalid email or password.");
  }
  const session = await createAdminSession(email);
  return { success: true, ...session };
});

exports.adminLogout = onCall(BASE_OPTS, async (request) => {
  await revokeAdminSession(request.data?.sessionToken);
  return { success: true };
});

exports.getAdminAccess = onCall(BASE_OPTS, async (request) => {
  if (!request.auth) {
    return { isAdmin: false };
  }
  return { isAdmin: isAdminRequest(request, adminEmails.value()) };
});

exports.getAdminDashboard = onCall({ ...BASE_OPTS, timeoutSeconds: 120 }, async (request) => {
  await requireAdminSession(request, adminEmails.value());
  const dashboard = await buildAdminDashboard();
  return { success: true, dashboard };
});

exports.listAdminUsers = onCall(BASE_OPTS, async (request) => {
  await requireAdminSession(request, adminEmails.value());
  const { limit, startAfterId } = stripSessionToken(request.data);
  const result = await listUsers({ limit, startAfterId });
  return { success: true, ...result };
});

exports.deleteUserData = onCall({ ...BASE_OPTS, timeoutSeconds: 120 }, async (request) => {
  const userId = requireAuth(request);
  const scope = request.data?.scope === "resume" ? "resume" : "account";

  if (scope === "resume") {
    await deleteUserResumeData(userId);
    return { success: true, scope: "resume", message: "Resume and parsed profile data deleted." };
  }

  await deleteAllUserFirestoreData(userId);
  try {
    await admin.auth().deleteUser(userId);
  } catch (err) {
    console.error("Auth user delete failed (Firestore already cleared):", err.message);
    throw new HttpsError(
      "internal",
      "Account data was deleted but sign-in could not be removed. Contact ranurainfotech@gmail.com if you still see your account."
    );
  }

  return { success: true, scope: "account", message: "Account and associated data deleted." };
});

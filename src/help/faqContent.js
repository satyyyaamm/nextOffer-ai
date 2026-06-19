import { PRO_PRICING } from "../theme";

/** @typedef {{ id: string, category: string, question: string, answer: string, keywords: string[], tags: string[] }} FaqItem */

export const FAQ_CATEGORIES = [
  { id: "getting_started", label: "Getting started" },
  { id: "resume", label: "Resume" },
  { id: "job_search", label: "Job search" },
  { id: "application_kit", label: "Application kit" },
  { id: "pro_billing", label: "Pro & billing" },
  { id: "privacy", label: "Privacy & data" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const SUPPORT_EMAIL = "ranurainfotech@gmail.com";

/** @type {FaqItem[]} */
export const FAQ_ITEMS = [
  {
    id: "sign_in",
    category: "getting_started",
    question: "How do I sign in?",
    answer:
      "Click Continue with Google on the landing page or login screen. NextOffer.ai uses Google sign-in only — no separate password. After sign-in, your profile and saved application kits are tied to that Google account.",
    keywords: ["login", "google", "account", "sign in"],
    tags: ["landing", "getting_started"],
  },
  {
    id: "workflow",
    category: "getting_started",
    question: "What is the step-by-step workflow?",
    answer:
      "1) Upload your resume (PDF or paste text). 2) Set job filters — country, role preferences, salary, and workplace type. 3) Run a search and review listings with compatibility scores. 4) Open a job and generate your application kit — tailored resume, cover letter, and cold email. 5) Copy or download documents and apply on the original job board.",
    keywords: ["steps", "how it works", "workflow", "process"],
    tags: ["landing", "getting_started"],
  },
  {
    id: "countries",
    category: "getting_started",
    question: "Which countries and regions are supported?",
    answer:
      "Job search supports the United States, India, United Kingdom, Canada, Australia, and Germany. Pick your country on the Search jobs screen. You can optionally narrow results to popular cities in that region. Salary filters use INR (LPA) for India and USD (thousands) for other regions.",
    keywords: ["country", "region", "location", "cities", "international"],
    tags: ["landing", "filters", "getting_started"],
  },
  {
    id: "sidebar_nav",
    category: "getting_started",
    question: "How do I move between screens?",
    answer:
      "Use the left sidebar (or mobile menu): Upload resume → Search jobs → Job results → Application kit. Job detail opens when you tap a listing; use Back to return to results. Screens unlock as you progress — for example, Job results appears after your first search.",
    keywords: ["navigation", "sidebar", "menu", "screens"],
    tags: ["getting_started"],
  },
  {
    id: "upload_resume",
    category: "resume",
    question: "How do I upload a resume?",
    answer:
      "On Upload resume, either drag and drop a PDF (max 5 MB) or paste your resume text (at least 50 characters). We parse your title, skills, and summary to power job matching and document generation. Text-based PDFs work best; scanned images may not parse reliably.",
    keywords: ["pdf", "paste", "upload", "file"],
    tags: ["resume", "landing"],
  },
  {
    id: "upload_limits",
    category: "resume",
    question: "How many times can I upload or update my resume?",
    answer:
      "Free plan: 1 resume upload per month. Pro: unlimited uploads and updates. If you hit the limit, upgrade to Pro or wait until your monthly quota resets.",
    keywords: ["limit", "free", "monthly", "update resume"],
    tags: ["resume", "free_limit", "pro"],
  },
  {
    id: "update_resume",
    category: "resume",
    question: "How do I update my resume after uploading?",
    answer:
      "Go to Upload resume from the sidebar, or tap Update resume on the Search jobs screen. Upload a new PDF or paste updated text. Pro users can update anytime; free users get one upload per month.",
    keywords: ["change", "replace", "edit", "re-upload"],
    tags: ["resume", "filters"],
  },
  {
    id: "search_how",
    category: "job_search",
    question: "How do I search for jobs?",
    answer:
      "After uploading a resume, open Search jobs. Set workplace type (remote, hybrid, onsite), country, optional cities, job type, date posted, and salary range. Tap Search — results usually take 20–40 seconds. Listings come from major boards via JSearch (LinkedIn, Indeed, and more).",
    keywords: ["search", "filters", "find jobs"],
    tags: ["filters", "getting_started"],
  },
  {
    id: "search_limits",
    category: "job_search",
    question: "How many job searches can I run?",
    answer:
      "Free plan: 1 job search per month. Pro: unlimited searches. Failed or empty searches may not count against your quota — if you see a limit message, upgrade to Pro for unlimited searches.",
    keywords: ["limit", "free", "monthly", "quota"],
    tags: ["filters", "free_limit", "pro"],
  },
  {
    id: "no_results",
    category: "job_search",
    question: "Why did my search return no jobs or very few results?",
    answer:
      "Try widening your filters: expand the date posted range, lower the salary minimum, remove city restrictions, or try a broader job type. Some niche roles have fewer listings. If the search errors out, check your connection and try again.",
    keywords: ["empty", "no jobs", "zero results", "failed"],
    tags: ["filters", "jobs", "troubleshooting"],
  },
  {
    id: "match_score",
    category: "job_search",
    question: "What is a compatibility or match score?",
    answer:
      "Each listing gets an AI compatibility score based on your parsed resume — skills, title, and experience — compared to the job description. Higher scores mean stronger alignment. Use scores to prioritize which roles to apply to first.",
    keywords: ["score", "match", "ranking", "percent"],
    tags: ["jobs", "landing"],
  },
  {
    id: "load_more",
    category: "job_search",
    question: "Can I load more job listings?",
    answer:
      "Yes. On Job results, use Load more jobs to fetch additional listings from the same search. Your original filters stay the same until you run a new search from Search jobs.",
    keywords: ["pagination", "more jobs", "load more"],
    tags: ["jobs"],
  },
  {
    id: "kit_generate",
    category: "application_kit",
    question: "How do I generate an application kit?",
    answer:
      "Open a job from Job results, then tap Generate on the job detail screen. We create three documents tailored to that role: resume, cover letter, and cold email. Generation takes a short moment. Saved kits appear in Application kit in the sidebar.",
    keywords: ["generate", "create", "documents", "ats"],
    tags: ["kit", "detail", "getting_started"],
  },
  {
    id: "kit_contents",
    category: "application_kit",
    question: "What is included in an application kit?",
    answer:
      "Each kit has three tabs: a tailored resume optimized for the job description, a cover letter, and a cold email you can send to recruiters. Switch tabs to view each document. Use Copy to clipboard or download options where available.",
    keywords: ["resume", "cover letter", "cold email", "tabs"],
    tags: ["kit", "detail"],
  },
  {
    id: "kit_limits",
    category: "application_kit",
    question: "How many application kits can I generate?",
    answer:
      "Free plan: 1 document generation per month (for any one job). You can still view saved kits after using your quota. Pro: unlimited generations plus Regenerate to refresh documents for any saved job.",
    keywords: ["limit", "free", "generation", "quota"],
    tags: ["kit", "free_limit", "pro", "detail"],
  },
  {
    id: "kit_download",
    category: "application_kit",
    question: "Can I download or regenerate documents?",
    answer:
      "All users can copy document text. Pro members can download PDFs and use Regenerate to create fresh versions for saved jobs. Free users cannot regenerate — upgrade to Pro for unlimited kits and PDF export.",
    keywords: ["pdf", "download", "regenerate", "copy"],
    tags: ["kit", "pro"],
  },
  {
    id: "kit_library",
    category: "application_kit",
    question: "Where are my saved application kits?",
    answer:
      "Open Application kit in the sidebar. You'll see every job you've generated documents for. Select a job to view its resume, cover letter, and cold email. Kits persist until you delete your account.",
    keywords: ["library", "saved", "history", "list"],
    tags: ["kit"],
  },
  {
    id: "apply_job",
    category: "application_kit",
    question: "How do I apply to a job?",
    answer:
      "Use Apply on [job board] on the job detail or kit viewer — it opens the original listing (LinkedIn, Indeed, etc.) in a new tab. Paste or upload your tailored documents from NextOffer.ai on that site. We don't submit applications on your behalf.",
    keywords: ["apply", "submit", "link", "external"],
    tags: ["detail", "kit"],
  },
  {
    id: "free_vs_pro",
    category: "pro_billing",
    question: "What is included in Free vs Pro?",
    answer:
      "Free: 1 resume upload, 1 job search, and 1 application kit generation per month; copy document text; standard support. Pro: unlimited uploads, searches, and kits; PDF download; regenerate documents; priority support; early feature access.",
    keywords: ["free", "pro", "plan", "compare", "features"],
    tags: ["landing", "pro", "free_limit"],
  },
  {
    id: "pro_pricing",
    category: "pro_billing",
    question: "How much does Pro cost?",
    answer: `Weekly Sprint: ${PRO_PRICING.symbol}${PRO_PRICING.weekly.amount}${PRO_PRICING.weekly.period}. Monthly Pro: ${PRO_PRICING.symbol}${PRO_PRICING.monthly.amount}${PRO_PRICING.monthly.period}. Prices are shown in USD; checkout is processed securely via Razorpay (INR charge for supported cards worldwide).`,
    keywords: ["price", "cost", "subscription", "weekly", "monthly"],
    tags: ["landing", "pro"],
  },
  {
    id: "upgrade_how",
    category: "pro_billing",
    question: "How do I upgrade to Pro?",
    answer:
      "Tap Upgrade to Pro when you hit a free limit, or open the upgrade modal from limit prompts. Choose Weekly Sprint or Monthly Pro, then complete checkout in the Razorpay window. Your card is handled by Razorpay — we don't store payment details.",
    keywords: ["upgrade", "subscribe", "checkout", "payment"],
    tags: ["pro", "free_limit"],
  },
  {
    id: "cancel_pro",
    category: "pro_billing",
    question: "How do I cancel my Pro subscription?",
    answer:
      "Cancel from your Razorpay subscription dashboard (link in payment confirmation email), or email support at ranurainfotech@gmail.com with the Google account you used to sign in. Cancellation stops future charges; you keep Pro until the current billing period ends.",
    keywords: ["cancel", "unsubscribe", "stop", "billing"],
    tags: ["pro"],
  },
  {
    id: "pro_not_active",
    category: "pro_billing",
    question: "I paid but Pro is not unlocked — what should I do?",
    answer:
      "Wait a minute and refresh the page. If Pro still doesn't appear, sign out and sign back in. Still stuck? Email ranurainfotech@gmail.com with your sign-in email and approximate payment time — we'll verify with Razorpay and fix your account.",
    keywords: ["payment failed", "not pro", "webhook", "stuck"],
    tags: ["pro", "troubleshooting"],
  },
  {
    id: "data_storage",
    category: "privacy",
    question: "How is my resume and data stored?",
    answer:
      "Your resume text and parsed profile are stored securely on our servers to power matching and document generation. We don't sell your data. Application kits are saved to your account. Read our Privacy Policy for full details.",
    keywords: ["storage", "security", "encrypted", "server"],
    tags: ["privacy", "landing"],
  },
  {
    id: "delete_data",
    category: "privacy",
    question: "How do I delete my resume or account?",
    answer:
      "Open Privacy & data in the sidebar (signed-in users). Delete resume & profile data removes uploads and parsed profile but keeps your account and saved kits. Delete account permanently removes everything including sign-in. This cannot be undone.",
    keywords: ["delete", "gdpr", "remove", "account"],
    tags: ["privacy"],
  },
  {
    id: "cookies_analytics",
    category: "privacy",
    question: "What about cookies and analytics?",
    answer:
      "We show a cookie banner on first visit. Accept to enable anonymous usage analytics (Firebase/GA4) that help us improve the product — no resume text or personal content is sent in analytics events. Decline to use the app without analytics cookies.",
    keywords: ["cookies", "analytics", "tracking", "consent"],
    tags: ["privacy", "landing"],
  },
  {
    id: "session_expired",
    category: "troubleshooting",
    question: "I see session expired or auth errors — what do I do?",
    answer:
      "Sign out and sign in again with Google. If the problem continues, clear site data for nextoffer-ai.web.app in your browser, then sign in fresh. Make sure third-party cookies aren't blocked for Google sign-in.",
    keywords: ["session", "auth", "login error", "expired"],
    tags: ["troubleshooting"],
  },
  {
    id: "reupload_resume",
    category: "troubleshooting",
    question: "Why does the app ask me to upload my resume again?",
    answer:
      "This appears when stored resume text is missing or outdated on our servers — for example after a data cleanup. Go to Upload resume and submit your PDF or pasted text again so we can regenerate documents.",
    keywords: ["reupload", "missing", "upload again", "banner"],
    tags: ["troubleshooting", "resume", "detail"],
  },
  {
    id: "contact_support",
    category: "troubleshooting",
    question: "How do I contact support?",
    answer: `Email ${SUPPORT_EMAIL} from the Google account you use to sign in. Include a short description of the issue and which screen you were on. We typically respond within 1–2 business days.`,
    keywords: ["support", "help", "email", "contact"],
    tags: ["troubleshooting", "landing"],
  },
];

export { SUPPORT_EMAIL };

/**
 * @param {string} query
 * @returns {FaqItem[]}
 */
export function filterFaq(query) {
  const q = query.trim().toLowerCase();
  if (!q) return FAQ_ITEMS;
  return FAQ_ITEMS.filter((item) => {
    const haystack = [
      item.question,
      item.answer,
      ...item.keywords,
      FAQ_CATEGORIES.find((c) => c.id === item.category)?.label || "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q) || q.split(/\s+/).some((word) => word.length > 2 && haystack.includes(word));
  });
}

/**
 * @param {Record<string, unknown>} context
 * @param {number} [limit=4]
 * @returns {FaqItem[]}
 */
export function getSuggestedFaq(context, limit = 4) {
  const { isLoggedIn, isPro, screen, hasResume } = context || {};
  const tagScores = new Map();

  const addTags = (tags, weight) => {
    for (const tag of tags) {
      if (!tag) continue;
      tagScores.set(tag, (tagScores.get(tag) || 0) + weight);
    }
  };

  if (!isLoggedIn) {
    addTags(["landing", "getting_started", "pro"], 3);
  } else {
    addTags(["getting_started"], 1);
    if (screen === "resume") addTags(["resume"], 4);
    if (screen === "filters") {
      addTags(["filters"], 4);
      if (!isPro) addTags(["free_limit"], 3);
    }
    if (screen === "jobs" || screen === "detail") addTags(["jobs", "detail"], 3);
    if (screen === "kit") addTags(["kit"], 4);
    if (!hasResume) addTags(["resume"], 2);
    if (!isPro) addTags(["free_limit", "pro"], 2);
  }

  const scored = FAQ_ITEMS.map((item) => {
    let score = 0;
    for (const tag of item.tags) {
      score += tagScores.get(tag) || 0;
    }
    return { item, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  const result = [];
  for (const { item } of scored) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (result.length >= limit) break;
  }

  if (result.length < limit) {
    for (const item of FAQ_ITEMS) {
      if (seen.has(item.id)) continue;
      result.push(item);
      if (result.length >= limit) break;
    }
  }

  return result;
}

/**
 * @param {string} categoryId
 * @param {FaqItem[]} [items=FAQ_ITEMS]
 * @returns {FaqItem[]}
 */
export function faqByCategory(categoryId, items = FAQ_ITEMS) {
  return items.filter((item) => item.category === categoryId);
}

/**
 * @param {string} id
 * @returns {FaqItem | null}
 */
export function getFaqById(id) {
  return FAQ_ITEMS.find((item) => item.id === id) || null;
}

/**
 * @param {string} query
 * @returns {FaqItem | null}
 */
export function findBestFaq(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const exact = FAQ_ITEMS.find((item) => item.question.toLowerCase() === q);
  if (exact) return exact;
  const results = filterFaq(q);
  return results[0] || null;
}

/**
 * @param {FaqItem} faqItem
 * @param {Set<string>} excludeIds
 * @param {number} [limit=3]
 * @returns {FaqItem[]}
 */
export function getRelatedFaq(faqItem, excludeIds, limit = 3) {
  const sameCategory = FAQ_ITEMS.filter(
    (item) => item.category === faqItem.category && !excludeIds.has(item.id) && item.id !== faqItem.id,
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
  const rest = FAQ_ITEMS.filter(
    (item) => item.id !== faqItem.id && !excludeIds.has(item.id) && item.category !== faqItem.category,
  );
  return [...sameCategory, ...rest].slice(0, limit);
}

/**
 * FAQ items for the public landing page (SEO + visible FAQ section).
 * @param {number} [limit=8]
 * @returns {FaqItem[]}
 */
export function getLandingFaqItems(limit = 8) {
  const landing = FAQ_ITEMS.filter((item) => item.tags.includes("landing"));
  if (landing.length >= limit) return landing.slice(0, limit);
  const rest = FAQ_ITEMS.filter((item) => !item.tags.includes("landing"));
  return [...landing, ...rest].slice(0, limit);
}

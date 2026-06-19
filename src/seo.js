/** Central SEO constants — override with REACT_APP_SITE_URL in production if needed. */
export const SITE_URL = (process.env.REACT_APP_SITE_URL || "https://nextoffer.ai").replace(/\/$/, "");
export const SITE_NAME = "NextOffer.ai";
export const SITE_TAGLINE = "AI job search, resume matching & ATS application kits";
export const DEFAULT_TITLE = `${SITE_NAME} — AI Job Search, Resume Matching & ATS Application Kits`;
export const DEFAULT_DESCRIPTION =
  "Find jobs matched to your resume with AI compatibility scores. Generate tailored ATS resumes, cover letters, and cold emails for every role. Free tier available — start with Google sign-in.";
export const DEFAULT_KEYWORDS =
  "AI job search, resume matching, ATS resume, cover letter generator, job application kit, tailored resume, job compatibility score, NextOffer";
export const OG_IMAGE = `${SITE_URL}/logo.png`;
export const SUPPORT_EMAIL = "ranurainfotech@gmail.com";

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * @param {{ title?: string, description?: string, canonical?: string, noindex?: boolean }} opts
 */
export function applyDocumentSeo(opts = {}) {
  const {
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    canonical = SITE_URL,
    noindex = false,
  } = opts;

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
  upsertMeta("name", "keywords", DEFAULT_KEYWORDS);

  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", OG_IMAGE);
  upsertMeta("property", "og:locale", "en_US");

  upsertMeta("name", "twitter:card", "summary");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", OG_IMAGE);

  upsertLink("canonical", canonical);
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: OG_IMAGE,
    email: SUPPORT_EMAIL,
    description: DEFAULT_DESCRIPTION,
  };
}

export function buildWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DEFAULT_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier with monthly limits; Pro plans from $5.99/week",
    },
    featureList: [
      "AI job compatibility scoring",
      "Resume parsing and job matching",
      "ATS-tailored resume generation",
      "Cover letter and cold email generation",
      "Application kit library",
    ],
  };
}

/**
 * @param {{ question: string, answer: string }[]} items
 */
export function buildFaqSchema(items) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

/**
 * @param {object} schema
 * @param {string} id
 */
export function injectJsonLd(schema, id) {
  if (!schema || typeof document === "undefined") return;
  const scriptId = `jsonld-${id}`;
  let el = document.getElementById(scriptId);
  if (!el) {
    el = document.createElement("script");
    el.id = scriptId;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(schema);
}

export function removeJsonLd(id) {
  document.getElementById(`jsonld-${id}`)?.remove();
}

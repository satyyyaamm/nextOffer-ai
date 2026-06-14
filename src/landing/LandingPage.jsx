import { useState, useEffect } from "react";
import { track } from "../analytics";
import { C, PRO_PRICING } from "../theme";
import { signInWithGoogle, authErrorMessage } from "../auth";
import { GoogleLogo, IconLock, IconShield, IconCheck, IconUpload, IconSearch, IconBuilding } from "../icons";
import { AppLogo } from "../brand";
import { LegalFooter } from "../ui";

const Spinner = ({ size = 20, color = C.accent }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `2px solid ${C.border}`,
      borderTopColor: color,
      animation: "spin .8s linear infinite",
      flexShrink: 0,
    }}
  />
);

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const FREE_FEATURES = [
  "1 Resume upload",
  "1 Job search with compatibility scores",
  "1 ATS kit (resume, cover letter, cold email)",
  "Standard support",
];

const PRO_FEATURES = [
  "Unlimited resumes & job searches",
  "Compatibility score on every listing",
  "Unlimited ATS resumes, cover letters & cold emails",
  "Priority support",
  "Early feature access",
];

const PRICING_PLANS = [
  {
    id: "free",
    name: "Free",
    price: `${PRO_PRICING.symbol}0`,
    period: "",
    subtitle: "Try the full workflow once per month",
    features: FREE_FEATURES,
    highlighted: false,
    badge: null,
  },
  {
    id: "weekly",
    name: "Weekly Sprint",
    price: `${PRO_PRICING.symbol}${PRO_PRICING.weekly.amount}`,
    period: PRO_PRICING.weekly.period,
    subtitle: "One intense job-hunt week",
    features: PRO_FEATURES,
    highlighted: true,
    badge: "Most Popular",
  },
  {
    id: "monthly",
    name: "Monthly Pro",
    price: `${PRO_PRICING.symbol}${PRO_PRICING.monthly.amount}`,
    period: PRO_PRICING.monthly.period,
    subtitle: "Cheaper than 2 weeks on Weekly",
    features: PRO_FEATURES,
    highlighted: false,
    badge: null,
  },
];

const TRUST_ITEMS = [
  { icon: IconLock, text: "256-bit encryption" },
  { icon: IconShield, text: "Your data is secure" },
  { text: "Cancel anytime" },
];

const PROCESS_STEPS = [
  {
    icon: IconUpload,
    title: "Upload Resume",
    description:
      "We analyze your skills and experience to understand what roles fit you best.",
  },
  {
    icon: IconSearch,
    title: "Get Matched",
    description:
      "We tailor jobs to your resume and show a compatibility score on each listing so you focus where you fit.",
  },
  {
    icon: IconBuilding,
    title: "Generate Documents",
    description:
      "Create personalised, ATS-proof resumes, cover letters, and cold emails for each job — built to get past ATS and in front of hiring teams.",
  },
  {
    icon: IconCheck,
    title: "Apply & Get Noticed",
    description:
      "Apply with documents tailored to the role and increase your chances of being seen by recruiters.",
  },
];

function scrollTo(href) {
  const id = href.replace("#", "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandingNavbar() {
  return (
    <header className="lp-nav">
      <div className="lp-container lp-nav__inner">
        <button type="button" className="lp-nav__brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <AppLogo size={36} style={{ boxShadow: "none" }} />
          <span className="lp-nav__brand-text">
            NextOffer<span className="lp-nav__brand-dot">.ai</span>
          </span>
        </button>

        <nav className="lp-nav__links" aria-label="Main">
          {NAV_LINKS.map(({ label, href }) => (
            <button key={href} type="button" className="lp-nav__link" onClick={() => scrollTo(href)}>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PricingCard({ plan, price, period, subtitle, features, highlighted, badge }) {
  return (
    <div className={`lp-plan hover-lift${highlighted ? " lp-plan--highlight" : ""}`}>
      {badge && <span className="lp-plan__badge">{badge}</span>}
      <h3 className="lp-plan__name">{plan}</h3>
      <p className="lp-plan__price">
        {price}
        {period && <span className="lp-plan__period">{period}</span>}
      </p>
      {subtitle && <p className="lp-plan__subtitle">{subtitle}</p>}
      <ul className="lp-plan__features">
        {features.map((f) => (
          <li key={f}>
            <IconCheck size={14} color={C.success} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingPage({ initialError = "" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    let referrerHost = "";
    try {
      if (document.referrer) referrerHost = new URL(document.referrer).hostname.slice(0, 64);
    } catch {
      referrerHost = "";
    }
    track("landing_view", { referrer_host: referrerHost || "direct" });
  }, []);

  const handleLogin = async (location = "hero") => {
    track("cta_click", { location });
    setLoading(true);
    setError("");
    try {
      const result = await signInWithGoogle();
      if (result.mode === "redirect") return;
    } catch (err) {
      const msg = authErrorMessage(err);
      if (msg) setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="lp-page">
      <LandingNavbar />

      <main>
        <section className="lp-hero" id="features">
          <div className="lp-container">
            <div className="lp-hero__grid">
              <div className="lp-hero__left">
                <span className="lp-hero__tag">Resume-matched jobs · ATS application kits</span>

                <h1 className="lp-hero__title">
                  Find better jobs.
                  <br />
                  <span className="lp-hero__title-accent">Apply with confidence.</span>
                </h1>

                <p className="lp-hero__desc">
                  We tailor job listings to your resume and show a compatibility score on every match.
                  Then generate personalised, ATS-proof resumes, cover letters, and cold emails so hiring teams actually see your application.
                </p>

                <div className="lp-hero__flow" aria-label="What NextOffer does">
                  <span>Jobs tailored to your resume</span>
                  <span className="lp-hero__flow-arrow" aria-hidden="true">→</span>
                  <span>Compatibility score per role</span>
                  <span className="lp-hero__flow-arrow" aria-hidden="true">→</span>
                  <span>ATS-proof resume, cover letter &amp; email</span>
                  <span className="lp-hero__flow-arrow" aria-hidden="true">→</span>
                  <span>Get seen by hiring teams</span>
                </div>

                <div className="lp-cta" id="cta">
                  <button
                    type="button"
                    className="lp-cta__btn btn-press"
                    onClick={() => handleLogin("hero")}
                    disabled={loading}
                  >
                    {loading ? <Spinner size={20} color="#fff" /> : <GoogleLogo size={22} />}
                    Continue with Google
                  </button>
                  {error && <p className="lp-cta__error">{error}</p>}
                </div>

                <div className="lp-trust">
                  {TRUST_ITEMS.map(({ icon: Icon, text }) => (
                    <span key={text} className="lp-trust__item">
                      {Icon ? <Icon size={16} color={C.sub} /> : null}
                      {text}
                    </span>
                  ))}
                </div>
              </div>

              <div className="lp-hero__right" id="pricing">
                <div className="lp-pricing-grid">
                  {PRICING_PLANS.map((p) => (
                    <PricingCard
                      key={p.id}
                      plan={p.name}
                      price={p.price}
                      period={p.period}
                      subtitle={p.subtitle}
                      features={p.features}
                      highlighted={p.highlighted}
                      badge={p.badge}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-divider lp-container" role="separator" />

        <section className="lp-process" id="how-it-works" aria-labelledby="lp-process-title">
          <div className="lp-container">
            <h2 id="lp-process-title" className="lp-process__title">
              How NextOffer.ai Works
            </h2>
            <ol className="lp-process__grid">
              {PROCESS_STEPS.map(({ icon: Icon, title, description }) => (
                <li key={title} className="lp-process__step">
                  <div className="lp-process__icon" aria-hidden="true">
                    <Icon size={32} color={C.accent} />
                  </div>
                  <h3 className="lp-process__step-title">{title}</h3>
                  <p className="lp-process__step-desc">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <LegalFooter style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }} />
          <p className="lp-footer__note">
            By signing in you agree to our secure processing of your resume for job matching only.
          </p>
        </div>
      </footer>
    </div>
  );
}

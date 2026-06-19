import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { C, font, cardStyle } from "./theme";
import { AppLogo } from "./brand";
import { IconLock, IconShield, IconCreditCard, IconCheck, IconUpload, IconSearch, IconBuilding, IconExternalLink, IconMenu, IconX } from "./icons";
import { setAnalyticsConsent, shouldShowConsentBanner, subscribeAnalyticsConsent } from "./consent";
import { initAnalyticsAfterConsent } from "./analytics";
import { useHelpFaq } from "./help/HelpFaqContext";

const MobileNavContext = createContext(null);

export function useMobileNav() {
  return useContext(MobileNavContext);
}

export function MobileNavToggle({ className = "" }) {
  const nav = useMobileNav();
  if (!nav) return null;
  return (
    <button
      type="button"
      className={`mobile-nav-toggle mobile-only ${className}`.trim()}
      onClick={nav.openNav}
      aria-label="Open navigation menu"
    >
      <IconMenu size={20} color={C.text} />
    </button>
  );
}

export const LegalFooter = ({ style = {} }) => (
  <footer
    style={{
      marginTop: 24,
      paddingTop: 16,
      borderTop: `1px solid ${C.border}`,
      fontSize: 12,
      color: C.sub,
      textAlign: "center",
      lineHeight: 1.8,
      ...style,
    }}
  >
    <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "none", marginRight: 12 }}>
      Privacy
    </a>
    <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "none", marginRight: 12 }}>
      Terms
    </a>
    <a href="mailto:ranurainfotech@gmail.com" style={{ color: C.accent, textDecoration: "none" }}>
      ranurainfotech@gmail.com
    </a>
  </footer>
);

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => shouldShowConsentBanner());

  useEffect(() => {
    return subscribeAnalyticsConsent(() => setVisible(shouldShowConsentBanner()));
  }, []);

  if (!visible) return null;

  const accept = () => {
    setAnalyticsConsent(true);
    setVisible(false);
    initAnalyticsAfterConsent();
  };

  const decline = () => {
    setAnalyticsConsent(false);
    setVisible(false);
  };

  return (
    <div className="cookie-consent" role="dialog" aria-label="Cookie preferences">
      <div className="cookie-consent__inner">
        <p className="cookie-consent__text">
          We use optional analytics cookies (Google Analytics) to understand how the product is used. We do not use them for ads.
          See our <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <div className="cookie-consent__actions">
          <button type="button" className="cookie-consent__btn cookie-consent__btn--secondary" onClick={decline}>
            Decline
          </button>
          <button type="button" className="cookie-consent__btn cookie-consent__btn--primary" onClick={accept}>
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function DataPrivacyModal({ open, onClose, onDeleteResume, onDeleteAccount, loading, error }) {
  const [confirmAccount, setConfirmAccount] = useState(false);

  useEffect(() => {
    if (!open) setConfirmAccount(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="data-privacy-modal" role="dialog" aria-modal="true" aria-labelledby="data-privacy-title">
      <button type="button" className="data-privacy-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="data-privacy-modal__panel">
        <h2 id="data-privacy-title" style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          Privacy &amp; data
        </h2>
        <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, marginBottom: 16 }}>
          Manage your data or read our policies. Deletion is permanent and cannot be undone.
        </p>
        <p style={{ fontSize: 13, marginBottom: 16 }}>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, marginRight: 12 }}>
            Privacy Policy
          </a>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
            Terms of Service
          </a>
        </p>

        {error && (
          <p style={{ fontSize: 13, color: C.danger, marginBottom: 12, lineHeight: 1.5 }}>{error}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            disabled={loading}
            onClick={onDeleteResume}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
              fontSize: 13,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            Delete resume &amp; profile data
            <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: C.muted, marginTop: 4 }}>
              Removes uploaded resumes and parsed profile. Keeps your account and saved application kits.
            </span>
          </button>

          {!confirmAccount ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmAccount(true)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${C.danger}44`,
                background: `${C.danger}08`,
                color: C.danger,
                fontSize: 13,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              Delete account
              <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: C.sub, marginTop: 4 }}>
                Permanently deletes your account, kits, and sign-in.
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={onDeleteAccount}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${C.danger}`,
                background: C.danger,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {loading ? "Deleting…" : "Confirm delete account"}
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
          You can also email{" "}
          <a href="mailto:ranurainfotech@gmail.com" style={{ color: C.accent }}>
            ranurainfotech@gmail.com
          </a>{" "}
          to request access, correction, or deletion.
        </p>

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.bg, color: C.sub, fontSize: 13, fontWeight: 600, border: `1px solid ${C.border}` }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export const TrustBadge = ({ icon: Icon, text }) => (
  <div className="trust-badge">
    <span className="trust-badge__icon" aria-hidden="true">
      {Icon ? <Icon size={15} color={C.accent} /> : <IconCheck size={15} color={C.success} />}
    </span>
    <span className="trust-badge__text">{text}</span>
  </div>
);

export const TrustFooter = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
    <TrustBadge icon={IconLock} text="256-bit encryption · HTTPS everywhere" />
    <TrustBadge icon={IconShield} text="Your resume is processed on secure servers — never sold or shared" />
    <TrustBadge icon={IconCreditCard} text="Secure global checkout via Razorpay — we never see your card details" />
    <TrustBadge icon={IconCheck} text="Google Sign-In — no passwords stored on our end" />
  </div>
);

export const SocialProofPills = ({ className = "" }) => (
  <div className={`social-proof-pills ${className}`.trim()} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
    {["Real jobs worldwide", "Resume stays private", "Cancel anytime"].map((label) => (
      <span
        key={label}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: C.sub,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 100,
          padding: "6px 12px",
        }}
      >
        {label}
      </span>
    ))}
  </div>
);

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    icon: IconUpload,
    title: "Upload your resume",
    description: "We parse your experience, skills, and title to build your job search profile.",
  },
  {
    step: 2,
    icon: IconSearch,
    title: "Set job filters",
    description: "Choose role, location, salary, and workplace — we search real listings across the web.",
  },
  {
    step: 3,
    icon: IconBuilding,
    title: "See best-fit jobs",
    description: "Every listing gets a match score against your resume so you focus on the right roles.",
  },
  {
    step: 4,
    icon: IconCheck,
    title: "Beat the ATS",
    description: "Generate a tailored resume, cover letter, and cold email per job to pass ATS and reach recruiters.",
  },
];

export const LANDING_BENEFITS = [
  "Real jobs from major boards (LinkedIn, Indeed, and more)",
  "Match scoring based on your resume — not generic keyword lists",
  "ATS-optimized documents tailored to each job description",
  "Saved application kit library for every role you apply to",
];

export function HowItWorksSteps({ compact = false, row = false }) {
  const isCompact = compact || row;

  return (
    <section
      className={`landing-steps${isCompact ? " landing-steps--compact" : ""}${row ? " landing-steps--row" : ""}`}
      aria-labelledby="landing-how-it-works"
    >
      <h2 id="landing-how-it-works" className="landing-section-title">
        How it works
      </h2>
      <ol className={`landing-steps-list${isCompact ? " landing-steps-list--compact" : ""}`}>
        {HOW_IT_WORKS_STEPS.map(({ step, icon: Icon, title, description }) => (
          <li key={step} className={`landing-step-card hover-lift${isCompact ? " landing-step-card--compact" : ""}`}>
            <div className="landing-step-card__icon" aria-hidden="true">
              <Icon size={isCompact ? 18 : 20} color={C.accent} />
            </div>
            <div className="landing-step-card__body">
              <div className="landing-step-card__meta">
                <span className="landing-step-card__num">Step {step}</span>
                <span className="landing-step-card__title">{title}</span>
              </div>
              {!isCompact && <p className="landing-step-card__desc">{description}</p>}
              {isCompact && <p className="landing-step-card__desc landing-step-card__desc--compact">{description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BenefitList({ plain = false }) {
  return (
    <section className="landing-benefits" aria-labelledby="landing-benefits">
      <h2 id="landing-benefits" className="landing-section-title">
        Why NextOffer
      </h2>
      <ul className={`landing-benefits-list${plain ? " landing-benefits-list--plain" : ""}`}>
        {LANDING_BENEFITS.map((text) => (
          <li key={text} className="landing-benefit-item">
            <IconCheck size={16} color={C.success} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  { id: "resume", label: "Upload" },
  { id: "filters", label: "Search" },
  { id: "jobs", label: "Apply" },
];

export function StepProgress({ current }) {
  const idx = STEPS.findIndex((s) => s.id === current || (current === "detail" && s.id === "jobs"));
  const activeIdx = current === "detail" ? 2 : idx >= 0 ? idx : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {STEPS.map((step, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step.id} style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: done || active ? C.accent : C.bg,
                  border: `2px solid ${done || active ? C.accent : C.border}`,
                  color: done || active ? "#fff" : C.muted,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done ? <IconCheck size={14} color="#fff" /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  color: active ? C.text : C.sub,
                  marginTop: 6,
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={done ? "step-progress-line" : ""}
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? C.accent : C.border,
                  marginBottom: 20,
                  minWidth: 12,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="animate-in" style={{ ...cardStyle, padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div
          className="skeleton-shimmer"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div className="skeleton-shimmer" style={{ height: 14, width: "70%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "50%", borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

export function JobsListSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((n) => (
        <JobCardSkeleton key={n} />
      ))}
    </>
  );
}

export const SecurityBanner = () => (
  <div
    style={{
      background: C.accentSoft,
      borderLeft: `3px solid ${C.accent}`,
      borderRadius: 8,
      padding: "12px 14px",
      marginBottom: 16,
      fontSize: 13,
      color: C.text,
      lineHeight: 1.55,
    }}
  >
    <strong>Private by design.</strong>{" "}
    <span style={{ color: C.sub }}>Your resume is processed on secure servers — never sold or shared.</span>
  </div>
);

export const primaryBtnStyle = (disabled = false) => ({
  width: "100%",
  padding: "14px 18px",
  borderRadius: C.radiusMd,
  background: disabled ? C.border : C.accentGradient,
  color: disabled ? C.muted : "#fff",
  fontSize: 15,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: font,
  boxShadow: disabled ? "none" : C.shadowAccent,
  transition: "transform 0.15s ease, box-shadow 0.2s ease, filter 0.15s ease",
});

export const outlineBtnStyle = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  background: C.surface,
  color: C.text,
  fontSize: 14,
  fontWeight: 600,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontFamily: font,
};

const KIT_TABS = [
  { id: "resume", label: "Resume", filePrefix: "resume" },
  { id: "cover_letter", label: "Cover letter", filePrefix: "cover-letter" },
  { id: "cold_email", label: "Email", filePrefix: "email" },
];

const KitSpinner = ({ size = 20 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `2px solid ${C.border}`,
      borderTopColor: C.accent,
      animation: "spin .8s linear infinite",
      flexShrink: 0,
    }}
  />
);

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function KitDocumentViewer({
  generated = {},
  tab,
  onTabChange,
  loadingKit = false,
  loadingGen = false,
  genError = "",
  readOnly = false,
  canGenerate = false,
  isPro = false,
  onGenerate,
  onRegenerate,
  onPromptUpgrade,
  upgradeMessage = "",
  freeTierNote = "",
  applyUrl,
  jobSource,
  jobTitle = "",
  company = "",
}) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const kitSteps = KIT_TABS.map((t) => ({
    ...t,
    done: Boolean(generated[t.id]),
  }));

  const activeTab = KIT_TABS.find((t) => t.id === tab) || KIT_TABS[0];
  const content = generated[tab];

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!content) return;
    const slug = [company, jobTitle].filter(Boolean).join("-").replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "document";
    downloadTextFile(`${activeTab.filePrefix}-${slug}.txt`, content);
  };

  const handleDownloadPdf = async () => {
    if (!content || tab !== "resume") return;
    setPdfBusy(true);
    try {
      const slug = [company, jobTitle].filter(Boolean).join("-").replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "resume";
      const { downloadResumePdf, normalizeResumePlainText } = await import("./resumePdf");
      downloadResumePdf(normalizeResumePlainText(content), `resume-${slug}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Could not create PDF. Try copying the text or use a desktop browser.");
    } finally {
      setPdfBusy(false);
    }
  };

  const isResumeTab = tab === "resume";

  return (
    <div className="kit-document-viewer">
      {freeTierNote && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.sub, lineHeight: 1.55 }}>{freeTierNote}</p>
      )}

      <div className="kit-doc-tabs" style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
        {KIT_TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              flex: 1,
              padding: "10px 4px",
              fontSize: 12,
              fontWeight: 600,
              color: tab === t.id ? C.accent : C.sub,
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              background: "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {kitSteps.map((s) => (
          <span
            key={s.id}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: s.done ? C.success : C.muted,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {s.done ? <IconCheck size={12} color={C.success} /> : "○"} {s.label}
          </span>
        ))}
      </div>

      {genError && <p style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{genError}</p>}

      <div
        className="kit-doc-preview"
        style={{
          ...cardStyle,
          padding: 16,
          minHeight: 200,
          maxHeight: "min(60vh, 520px)",
          overflowY: "auto",
          marginBottom: 14,
        }}
      >
        {loadingKit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub, fontSize: 13 }}>
            <KitSpinner /> Loading your saved documents…
          </div>
        ) : loadingGen && !content ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub }}>
            <KitSpinner /> Generating…
          </div>
        ) : content ? (
          <>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Saved — you can leave and come back anytime.</p>
            <div className="kit-resume-preview" style={{ color: C.text, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.65, fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {tab === "resume" ? content.replace(/●/g, "•") : content}
            </div>
          </>
        ) : readOnly ? (
          <p style={{ color: C.sub, fontSize: 13 }}>No {activeTab.label.toLowerCase()} saved for this job.</p>
        ) : !canGenerate ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.sub, fontSize: 13, marginBottom: 12, lineHeight: 1.55 }}>{upgradeMessage}</p>
            {onPromptUpgrade && (
              <button type="button" onClick={onPromptUpgrade} style={primaryBtnStyle()}>
                Upgrade to Pro
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => onGenerate?.(tab)} style={outlineBtnStyle}>
            Generate {activeTab.label}
          </button>
        )}
      </div>

      <div className="kit-doc-actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {content && (
          <>
            <button type="button" onClick={handleCopy} style={primaryBtnStyle()} disabled={loadingGen}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
            {isResumeTab && isPro && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                style={outlineBtnStyle}
                disabled={loadingGen || pdfBusy}
              >
                {pdfBusy ? "Creating PDF…" : "Download PDF"}
              </button>
            )}
            {isResumeTab && !isPro && (
              <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                PDF download is available on Pro. Free plan: copy the resume text above.
              </p>
            )}
            {!isResumeTab && (
              <button type="button" onClick={handleDownloadTxt} style={outlineBtnStyle} disabled={loadingGen}>
                Download .txt
              </button>
            )}
            {onRegenerate && !readOnly && (
              <button
                type="button"
                disabled={loadingGen}
                onClick={() => {
                  if (window.confirm(`This will replace your saved ${activeTab.label.toLowerCase()}. Continue?`)) {
                    onRegenerate(tab);
                  }
                }}
                style={{ ...outlineBtnStyle, color: C.accent, borderColor: `${C.accent}66` }}
              >
                {loadingGen ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <KitSpinner size={16} /> Regenerating…
                  </span>
                ) : (
                  `Regenerate ${activeTab.label}`
                )}
              </button>
            )}
          </>
        )}
        {applyUrl && (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...outlineBtnStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            Apply on {jobSource || "job board"} <IconExternalLink size={14} color={C.text} />
          </a>
        )}
      </div>
    </div>
  );
}

export { KIT_TABS };

export const FilterSection = ({ label, children, fullWidth = false }) => (
  <div
    className={`filter-section hover-lift${fullWidth ? " filter-section--full" : ""}`}
    style={{ ...cardStyle, padding: 16, marginBottom: 0 }}
  >
    <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>{label}</div>
    {children}
  </div>
);

export const MobileOnly = ({ children, className = "" }) => (
  <div className={`mobile-only ${className}`.trim()}>{children}</div>
);

export const DesktopOnly = ({ children, className = "" }) => (
  <div className={`desktop-only ${className}`.trim()}>{children}</div>
);

export const PageTitle = ({ title, subtitle }) => (
  <div className="page-title desktop-only">
    <h1>{title}</h1>
    {subtitle && <p>{subtitle}</p>}
  </div>
);

export const PageMain = ({ children, variant = "default", className = "", enter = false }) => (
  <div
    className={`page-main ${variant === "form" ? "page-main--form" : ""} ${variant === "full" ? "page-main--full" : ""} ${enter ? "view-enter" : ""} ${className}`.trim()}
  >
    {children}
  </div>
);

const SIDEBAR_NAV = [
  { id: "resume", label: "Upload resume", icon: IconUpload },
  { id: "filters", label: "Search jobs", icon: IconSearch },
  { id: "jobs", label: "Job results", icon: IconBuilding },
  { id: "kit", label: "Application kit", icon: IconCheck },
];

export function AppSidebar({
  screen,
  onNavigate,
  onLogout,
  onClose,
  onOpenDataPrivacy,
  hasProfile,
  hasJobs,
  isPro,
  userEmail,
  kitCount = 0,
  variant = "desktop",
}) {
  const { open: openHelp } = useHelpFaq();
  const activeScreen = screen === "detail" ? "jobs" : screen;
  const isDrawer = variant === "mobile";

  const canNav = (id) => {
    if (id === "resume") return true;
    if (id === "filters") return hasProfile;
    if (id === "jobs") return hasJobs;
    if (id === "kit") return hasProfile;
    return false;
  };

  const handleNavigate = (id) => {
    if (!canNav(id)) return;
    onNavigate(id);
    onClose?.();
  };

  return (
    <aside className={`app-sidebar${isDrawer ? " app-sidebar--drawer" : ""}`}>
      {isDrawer ? (
        <div className="app-sidebar__drawer-head">
          <div className="app-sidebar__drawer-brand">
            <AppLogo size={32} style={{ boxShadow: C.shadowSm, flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              NextOffer<span style={{ color: C.brandHighlight }}>.ai</span>
            </span>
          </div>
          <button type="button" className="app-sidebar__close" onClick={onClose} aria-label="Close menu">
            <IconX size={20} color={C.text} />
          </button>
        </div>
      ) : (
        <div className="app-sidebar__brand">
          <AppLogo size={40} style={{ marginBottom: 12, boxShadow: C.shadowSm }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>
            NextOffer<span style={{ color: C.brandHighlight }}>.ai</span>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Land your next offer</div>
        </div>
      )}

      <nav className="app-sidebar__nav" aria-label="Main navigation">
        {SIDEBAR_NAV.map(({ id, label, icon: Icon }) => {
          const enabled = canNav(id);
          const active = activeScreen === id;
          return (
            <button
              key={id}
              type="button"
              className={`sidebar-nav-item${active ? " sidebar-nav-item--active" : ""}`}
              disabled={!enabled}
              onClick={() => handleNavigate(id)}
            >
              <Icon size={18} color={active ? C.accent : C.sub} />
              {label}
              {id === "kit" && kitCount > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: C.accentSoft, color: C.accent, padding: "2px 8px", borderRadius: 100 }}>
                  {kitCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="app-sidebar__footer">
        {isPro && (
          <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <IconCheck size={14} color={C.success} /> Pro member
          </div>
        )}
        {userEmail && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={userEmail}>
            {userEmail}
          </div>
        )}
        <button
          type="button"
          className="sidebar-help-link"
          onClick={() => {
            openHelp();
            onClose?.();
          }}
        >
          Help &amp; FAQ
        </button>
        <button
          type="button"
          className="sidebar-privacy-link"
          onClick={() => {
            onOpenDataPrivacy?.();
            onClose?.();
          }}
        >
          Privacy &amp; data
        </button>
        <button
          type="button"
          onClick={() => {
            onLogout();
            onClose?.();
          }}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.bg, color: C.sub, fontSize: 13, fontWeight: 600, border: `1px solid ${C.border}` }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

export function AppShell({
  screen,
  onNavigate,
  onLogout,
  onOpenDataPrivacy,
  hasProfile,
  hasJobs,
  isPro,
  userEmail,
  kitCount = 0,
  children,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openNav = useCallback(() => setMobileNavOpen(true), []);
  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  const mobileNav = useMemo(() => ({ openNav, closeNav }), [openNav, closeNav]);

  useEffect(() => {
    closeNav();
  }, [screen, closeNav]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const sidebarProps = {
    screen,
    onNavigate,
    onLogout,
    onOpenDataPrivacy,
    hasProfile,
    hasJobs,
    isPro,
    userEmail,
    kitCount,
  };

  return (
    <MobileNavContext.Provider value={mobileNav}>
      <div className="app-shell">
        <AppSidebar {...sidebarProps} variant="desktop" />
        {mobileNavOpen && (
          <button
            type="button"
            className="app-mobile-nav-backdrop mobile-only"
            aria-label="Close navigation menu"
            onClick={closeNav}
          />
        )}
        <div
          className={`app-mobile-nav mobile-only${mobileNavOpen ? " app-mobile-nav--open" : ""}`}
          aria-hidden={!mobileNavOpen}
        >
          <AppSidebar {...sidebarProps} variant="mobile" onClose={closeNav} />
        </div>
        <div className="app-main">{children}</div>
      </div>
    </MobileNavContext.Provider>
  );
}

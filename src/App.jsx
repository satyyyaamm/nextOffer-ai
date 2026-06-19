import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { bootstrapAuth, authErrorMessage } from "./auth";
import {
  getUserProfile as getUserProfileFn,
  parseResume as parseResumeFn,
  searchJobs as searchJobsFn,
  generateDocument as generateDocumentFn,
  getJobKit as getJobKitFn,
  listJobKits as listJobKitsFn,
  createCheckoutSession as createCheckoutFn,
  verifyRazorpaySubscription as verifyRazorpaySubscriptionFn,
  deleteUserData as deleteUserDataFn,
} from "./callable";
import { openRazorpaySubscriptionCheckout } from "./razorpay";
import { loadOrCreateUserProfile } from "./userProfile";
import {
  track,
  trackScreen,
  identifyUser,
  clearUser,
  signupWeekFromDate,
  topMatchBucket,
  matchScoreBucket,
  errorCodeFromErr,
  upgradeReasonKey,
} from "./analytics";
import { setCrashScreen } from "./crashReporting";
import { C, font, cardStyle, REGIONS, TOP_CITIES_BY_REGION, PRO_PRICING } from "./theme";
import {
  IconSearch,
  IconUpload,
  IconHome,
  IconBuilding,
  IconClock,
  IconCheck,
  IconCreditCard,
} from "./icons";
import {
  TrustBadge,
  StepProgress,
  SecurityBanner,
  JobsListSkeleton,
  primaryBtnStyle,
  outlineBtnStyle,
  FilterSection,
  AppShell,
  PageMain,
  PageTitle,
  MobileOnly,
  MobileNavToggle,
  CookieConsentBanner,
  DataPrivacyModal,
  KitDocumentViewer,
} from "./ui";
import { LandingPage } from "./landing/LandingPage";
import { HelpFaqProvider, useHelpFaq } from "./help/HelpFaqContext";
import { HelpFaqWidget } from "./help/HelpFaqWidget";
import { applyDocumentSeo } from "./seo";

// ─── Shared UI ───────────────────────────────────────────────────────────────

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    :root{
      --c-bg:${C.bg};
      --c-surface:${C.surface};
      --c-border:${C.border};
      --c-text:${C.text};
      --c-sub:${C.sub};
      --c-muted:${C.muted};
      --c-accent:${C.accent};
      --c-accent-hover:${C.accentHover};
      --c-accent-soft:${C.accentSoft};
      --c-accent-gradient:${C.accentGradient};
      --c-surface-muted:${C.surfaceMuted};
      --c-border-light:${C.borderLight};
      --c-brand:${C.brandHighlight};
      --c-success:${C.success};
      --c-danger:${C.danger};
      --c-warning:${C.warning};
      --c-login-bg:${C.loginGradient};
      --c-shadow-sm:${C.shadowSm};
      --c-shadow-md:${C.shadowMd};
    }
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
    body{background:${C.bg};color:${C.text};font-family:${font};width:100%;overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
    html{width:100%;overflow-x:hidden;}
    #root{width:100%;max-width:100%;}
    input,textarea,select{outline:none;font-family:${font};color:${C.text};}
    input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid ${C.accent};outline-offset:2px;}
    ::selection{background:${C.accentSoft};color:${C.text};}
    button{cursor:pointer;border:none;background:transparent;font-family:${font};}
    .btn-premium{background:${C.accentGradient};color:#fff;box-shadow:${C.shadowAccent};border:none;font-weight:600;transition:transform 0.15s ease,box-shadow 0.2s ease,filter 0.15s ease;}
    .btn-premium:hover:not(:disabled){filter:brightness(1.04);box-shadow:0 6px 20px rgba(15,118,110,0.32);transform:translateY(-1px);}
    .btn-premium:active:not(:disabled){transform:translateY(0);}
    button:active:not(:disabled){transform:scale(0.98);}
    a{color:${C.accent};}
  `}</style>
);


const Spinner = ({ size = 20, color = C.accent }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${C.border}`, borderTopColor: color, animation: "spin .8s linear infinite", flexShrink: 0 }} />
);

const Chip = ({ label, active, onClick, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 14px",
      borderRadius: 100,
      border: `1px solid ${active ? C.accent : C.border}`,
      background: active ? C.accentSoft : C.surface,
      color: active ? C.accent : C.sub,
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: "nowrap",
      boxShadow: active ? "none" : C.shadowSm,
      transition: "border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease",
    }}
  >
    {Icon && <Icon size={14} color={active ? C.accent : C.sub} />}
    {label}
  </button>
);

/** Toggle item in a multi-select filter; always keeps at least one option selected. */
function toggleMultiSelect(current, value) {
  if (current.includes(value)) {
    const next = current.filter((v) => v !== value);
    return next.length > 0 ? next : current;
  }
  return [...current, value];
}

/** Toggle without forcing a selection — used for optional filters like city. */
function toggleOptionalMultiSelect(current, value) {
  if (current.includes(value)) return current.filter((v) => v !== value);
  return [...current, value];
}

const ProgressBar = ({ value, color = C.accent }) => (
  <div style={{ height: 4, background: C.border, borderRadius: 4, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 4, transition: "width .8s ease" }} />
  </div>
);

function companyInitial(company) {
  const c = String(company || "?").trim();
  return c.charAt(0).toUpperCase();
}

function formatKitDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function kitKeyForJob(job) {
  const company = String(job?.company || "unknown").trim().toLowerCase();
  const title = String(job?.title || job?.id || "role").trim().toLowerCase();
  return `${company}__${title}`.replace(/[/\\.#[\]]/g, "_").slice(0, 150);
}

function jobMatchesKit(job, kitJobId) {
  if (!kitJobId || !job) return false;
  return kitKeyForJob(job) === kitJobId || String(job.id) === String(kitJobId);
}

function snapshotToJob(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.originalJobId || "",
    title: snapshot.title || "",
    company: snapshot.company || "",
    location: snapshot.location || "",
    workplace: snapshot.workplace || "",
    employment_type: snapshot.employment_type || "",
    posted: snapshot.posted || "",
    description: snapshot.description || "",
    apply_url: snapshot.apply_url || "",
    source: snapshot.source || "",
    salary_min: snapshot.salary_min ?? 0,
    salary_max: snapshot.salary_max ?? 0,
    salary_unit: snapshot.salary_unit || "",
    match_score: snapshot.match_score ?? 0,
    api: snapshot.description ? { job_description: snapshot.description } : {},
  };
}

function formatSnapshotSalary(snapshot, currencySymbol = "$") {
  if (!snapshot) return null;
  const min = snapshot.salary_min;
  const max = snapshot.salary_max;
  if (min > 0 || max > 0) {
    if (snapshot.salary_unit === "lpa") return `₹${min}–${max} LPA`;
    return `${currencySymbol}${min}k–${currencySymbol}${max}k / year`;
  }
  return null;
}

const JobSnapshotCard = ({ snapshot, applyUrl, currencySymbol = "$" }) => {
  const [descOpen, setDescOpen] = useState(false);
  if (!snapshot) return null;
  const salaryLabel = formatSnapshotSalary(snapshot, currencySymbol);
  const url = applyUrl || snapshot.apply_url;

  return (
    <div className="kit-job-info" style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
        Job details
      </div>
      {snapshot.company && <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{snapshot.company}</div>}
      {snapshot.title && <div style={{ fontSize: 15, fontWeight: 600, color: C.accent, marginTop: 4 }}>{snapshot.title}</div>}
      <div style={{ fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 1.55 }}>
        {[snapshot.location, snapshot.workplace, snapshot.posted].filter(Boolean).join(" · ")}
      </div>
      {salaryLabel && (
        <div style={{ fontSize: 13, color: C.success, fontWeight: 600, marginTop: 6 }}>{salaryLabel}</div>
      )}
      {snapshot.description && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setDescOpen((o) => !o)}
            style={{ fontSize: 13, fontWeight: 600, color: C.accent, padding: 0 }}
          >
            {descOpen ? "Hide description" : "Show description"}
          </button>
          {descOpen && (
            <div
              className="kit-job-info__description"
              style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginTop: 10, whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto" }}
            >
              {snapshot.description}
            </div>
          )}
        </div>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
            fontSize: 13,
            fontWeight: 600,
            color: C.accent,
            textDecoration: "none",
          }}
        >
          Apply on {snapshot.source || "job board"}
        </a>
      )}
    </div>
  );
};

// ─── Landing (pre-login) ─────────────────────────────────────────────────────

const LandingScreen = ({ initialError = "" }) => <LandingPage initialError={initialError} />;

// ─── Checkout success toast ──────────────────────────────────────────────────

const CheckoutSuccessBanner = ({ onDismiss }) => (
  <div className="animate-scale" style={{ position: "fixed", top: 16, left: 16, right: 16, zIndex: 100, background: C.greenGlow, border: `1px solid ${C.success}44`, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: C.shadowMd, maxWidth: 448, margin: "0 auto" }}>
    <span style={{ color: C.success, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
      <IconCheck size={16} color={C.success} /> Welcome to Pro! Unlimited searches unlocked.
    </span>
    <button type="button" onClick={onDismiss} style={{ color: C.sub, fontSize: 18, padding: "0 4px" }}>×</button>
  </div>
);

// ─── Dashboard ───────────────────────────────────────────────────────────────

function callableErrorMessage(err) {
  if (!err) return "Something went wrong. Please try again.";
  const code = err.code || "";
  const msg = err.message || "";

  if (code === "functions/unauthenticated" || code === "unauthenticated") {
    return "Session expired. Sign out and sign in again.";
  }
  if (msg.includes("Failed to fetch") || msg.includes("Network")) {
    return "Can’t reach the server. Check your connection and try again.";
  }
  const details = typeof err.details === "string" ? err.details : "";
  if (details && details !== "internal") {
    return details.replace(/^FREE_(?:KIT_USED|LIMIT:\w+):\s*/i, "");
  }
  if (
    code === "functions/internal" ||
    code === "internal" ||
    /^internal$/i.test(msg)
  ) {
    return "Server error. Sign out, refresh, and try again. If this persists, redeploy Cloud Functions.";
  }
  if (msg && !/^internal$/i.test(msg)) {
    return msg.replace(/^FREE_(?:KIT_USED|LIMIT:\w+):\s*/i, "");
  }
  return "Something went wrong. Please try again.";
}

const UPGRADE_MESSAGES = {
  search: "You've used your free job search for this month.",
  upload: "You've used your free resume upload for this month. Upgrade to Pro for unlimited uploads and updates.",
  kit: "You've used your free generation for this month. Upgrade to Pro for unlimited generations and regenerate.",
  kitOtherJob: "Free plan includes one document generation per month. Upgrade to Pro for more jobs and regenerate.",
  generic: "You've reached your free plan limit for this month.",
};

function limitMessage(err) {
  const details = typeof err?.details === "string" ? err.details : "";
  return `${err?.message || ""} ${details}`.trim();
}

/** True when the backend rejected an action due to free-tier monthly limits. */
function shouldPromptUpgrade(err) {
  if (!err) return false;
  const code = err.code || "";
  const msg = limitMessage(err);
  if (msg.includes("FREE_LIMIT:") || msg.includes("FREE_KIT_USED")) return true;
  if (code === "functions/resource-exhausted" || code === "resource-exhausted") {
    return /free tier|free plan|free kit|upgrade for unlimited|upgrade to pro/i.test(msg);
  }
  return false;
}

function upgradeReasonFromError(err) {
  const msg = limitMessage(err);
  if (msg.includes("FREE_LIMIT:upload") || /resume upload/i.test(msg)) return UPGRADE_MESSAGES.upload;
  if (msg.includes("FREE_LIMIT:search") || /job search/i.test(msg)) return UPGRADE_MESSAGES.search;
  if (/another job/i.test(msg)) return UPGRADE_MESSAGES.kitOtherJob;
  if (msg.includes("FREE_KIT_USED") || /application kit/i.test(msg)) return UPGRADE_MESSAGES.kit;
  return UPGRADE_MESSAGES.generic;
}

function isSearchLimitResponse(data) {
  return data?.error === "Limit reached";
}

function isInsufficientSearchResponse(data) {
  return data?.insufficientResults === true;
}

function HelpFaqContextSync({ screen, showUpgrade }) {
  const { setContext } = useHelpFaq();
  useEffect(() => {
    const mobileDockVisible = screen === "jobs" || screen === "detail";
    setContext({ screen, mobileDockVisible, upgradeModalOpen: showUpgrade });
  }, [screen, showUpgrade, setContext]);
  return null;
}

const DashboardScreen = ({ userProfile, onProfileUpdate, showProBanner, onShowProBanner, onDismissProBanner, profileLoading, profileError }) => {
  const savedProfile = userProfile?.parsedProfile;
  const hasSavedProfile = Boolean(savedProfile?.title);

  const [screen, setScreen] = useState(() => (hasSavedProfile ? "filters" : "resume"));
  const [profile, setProfile] = useState(() => savedProfile?.title ? savedProfile : null);
  const [jobs, setJobs] = useState([]);
  const [jobsListKey, setJobsListKey] = useState(0);
  const [jobsMeta, setJobsMeta] = useState({
    hasMoreApi: false,
    nextApiPage: 2,
    filters: null,
    datePostedNotice: null,
    jsearchStats: null,
  });
  const [loadingMoreJobs, setLoadingMoreJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [generated, setGenerated] = useState({});
  const [loadingKit, setLoadingKit] = useState(false);
  const [needsResumeReupload, setNeedsResumeReupload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState(UPGRADE_MESSAGES.generic);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [kitCount, setKitCount] = useState(0);
  const [dataPrivacyOpen, setDataPrivacyOpen] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [deleteDataError, setDeleteDataError] = useState("");
  const [kitScreenCache, setKitScreenCache] = useState({
    kitList: [],
    selectedKey: null,
    loadedKitKey: null,
    generated: {},
    jobSnapshot: null,
    applyUrl: "",
    tab: "resume",
    mobileShowViewer: false,
  });

  const isPro = userProfile?.tier === "pro";
  const searchesUsed = userProfile?.searches?.count || 0;
  const uploadsUsed = userProfile?.resumeUploads?.count || 0;
  const kitUsed = !isPro && Boolean(
    userProfile?.applicationKit?.resume
    || userProfile?.applicationKit?.cover_letter
    || userProfile?.applicationKit?.cold_email
  );

  const openUpgrade = useCallback((reason) => {
    const msg = reason || UPGRADE_MESSAGES.generic;
    setUpgradeReason(msg);
    setShowUpgrade(true);
    track("upgrade_modal_view", { reason: upgradeReasonKey(msg) });
  }, []);

  useEffect(() => {
    trackScreen(screen);
    setCrashScreen(screen);
  }, [screen]);

  const refreshKitCount = useCallback(async () => {
    if (!hasSavedProfile) {
      setKitCount(0);
      return;
    }
    try {
      const result = await listJobKitsFn();
      setKitCount((result.data?.kits || []).length);
    } catch {
      /* ignore — sidebar badge is optional */
    }
  }, [hasSavedProfile]);

  useEffect(() => {
    refreshKitCount();
  }, [refreshKitCount, userProfile]);

  // When Firestore profile loads after sign-in, restore saved parsed resume profile.
  useEffect(() => {
    if (profileLoading || !userProfile) return;
    const saved = userProfile.parsedProfile;
    if (saved?.title) {
      setProfile(saved);
      setScreen((current) => (current === "resume" ? "filters" : current));
    }
  }, [userProfile, profileLoading]);

  const handleLogout = () => {
    clearUser();
    signOut(auth);
  };

  const handleDeleteResumeData = async () => {
    if (
      !window.confirm(
        "Delete all uploaded resumes and parsed profile data? Your account and saved application kits will remain. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingData(true);
    setDeleteDataError("");
    try {
      await deleteUserDataFn({ scope: "resume" });
      setProfile(null);
      setJobs([]);
      setSelectedJob(null);
      setGenerated({});
      setDataPrivacyOpen(false);
      await onProfileUpdate();
      setScreen("resume");
      track("data_delete", { scope: "resume" });
    } catch (err) {
      setDeleteDataError(callableErrorMessage(err));
    } finally {
      setDeletingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingData(true);
    setDeleteDataError("");
    try {
      await deleteUserDataFn({ scope: "account" });
      track("data_delete", { scope: "account" });
      clearUser();
      setDataPrivacyOpen(false);
      await signOut(auth);
    } catch (err) {
      setDeleteDataError(callableErrorMessage(err));
      setDeletingData(false);
    }
  };

  const runJobSearch = async (profileData, filtersData) => {
    const result = await searchJobsFn({ profile: profileData, filters: filtersData });
    const data = result.data || {};

    if (isInsufficientSearchResponse(data)) {
      track("search_empty", { reason: "insufficient_results" });
      alert(data.message || "No jobs found. Your free search was not used — try different filters.");
      setScreen("filters");
      return false;
    }
    if (isSearchLimitResponse(data)) {
      track("free_limit_reached", { action: "search" });
      openUpgrade(data.message || UPGRADE_MESSAGES.search);
      setScreen("filters");
      return false;
    }

    const jobList = data.jobs || [];
    if (jobList.length === 0) {
      track("search_empty", { reason: "no_matches" });
      alert("No jobs matched these filters. Your free search was not used — try fewer cities, a broader country, or a wider salary range.");
      setScreen("filters");
      return false;
    }

    track("search_success", {
      job_count: jobList.length,
      top_match_bucket: topMatchBucket(jobList),
    });

    setJobs(jobList);
    setJobsMeta({
      hasMoreApi: Boolean(data.hasMoreApi),
      nextApiPage: data.nextApiPage || 6,
      filters: filtersData,
      datePostedNotice: data.datePostedNotice || null,
      jsearchStats: data.jsearchStats || null,
    });
    setJobsListKey((k) => k + 1);
    if (data.currency?.symbol) setCurrencySymbol(data.currency.symbol);
    await onProfileUpdate();
    setScreen("jobs");
    return true;
  };

  const loadMoreJobsFromApi = async () => {
    if (!profile?.title || !jobsMeta.filters || loadingMoreJobs) return;
    setLoadingMoreJobs(true);
    try {
      const result = await searchJobsFn({
        profile,
        filters: jobsMeta.filters,
        apiPage: jobsMeta.nextApiPage,
        paginateOnly: true,
      });
      const more = result.data.jobs || [];
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.id));
        const merged = [...prev];
        more.forEach((j) => {
          if (!seen.has(j.id)) {
            seen.add(j.id);
            merged.push(j);
          }
        });
        return merged;
      });
      setJobsMeta({
        hasMoreApi: Boolean(result.data.hasMoreApi),
        nextApiPage: result.data.nextApiPage || jobsMeta.nextApiPage + 1,
        filters: jobsMeta.filters,
      });
    } catch (err) {
      alert(callableErrorMessage(err));
    }
    setLoadingMoreJobs(false);
  };

  const uploadResume = async ({ text, pdfFile }) => {
    if (!isPro && uploadsUsed >= 1) {
      track("free_limit_reached", { action: "upload" });
      openUpgrade(UPGRADE_MESSAGES.upload);
      return;
    }
    if (profileError) {
      await onProfileUpdate();
    }
    track("resume_upload_start");
    setLoading(true);
    try {
      let payload;
      if (pdfFile) {
        const resumePdfBase64 = await fileToBase64(pdfFile);
        payload = { resumePdfBase64, fileName: pdfFile.name };
      } else {
        payload = { resumeText: text };
      }
      const result = await parseResumeFn(payload);
      setProfile(result.data.parsed);
      await onProfileUpdate();
      track("resume_upload_success", {
        has_profile_fields: Boolean(result.data.parsed?.title),
      });
      setScreen("filters");
    } catch (err) {
      if (shouldPromptUpgrade(err)) {
        track("free_limit_reached", { action: "upload" });
        openUpgrade(upgradeReasonFromError(err));
      } else {
        track("resume_upload_failure", { error_code: errorCodeFromErr(err) });
        alert(callableErrorMessage(err));
      }
    }
    setLoading(false);
  };

  const searchJobs = async (filtersData) => {
    if (!profile?.title) {
      alert("Upload your resume first.");
      return;
    }
    if (!isPro && searchesUsed >= 1) {
      track("free_limit_reached", { action: "search" });
      openUpgrade(UPGRADE_MESSAGES.search);
      return;
    }
    track("search_start");
    setJobs([]);
    setJobsMeta((prev) => ({
      ...prev,
      hasMoreApi: false,
      filters: filtersData,
      datePostedNotice: null,
      jsearchStats: null,
    }));
    setSearchLoading(true);
    try {
      await runJobSearch(profile, filtersData);
    } catch (err) {
      if (shouldPromptUpgrade(err)) {
        track("free_limit_reached", { action: "search" });
        openUpgrade(upgradeReasonFromError(err));
      } else {
        track("search_failure", { error_code: errorCodeFromErr(err) });
        alert(callableErrorMessage(err));
      }
    }
    setSearchLoading(false);
  };

  const openJobDetail = useCallback(async (job) => {
    track("job_open", { match_bucket: matchScoreBucket(job.matchScore ?? job.match_score) });
    setSelectedJob(job);
    setScreen("detail");
    setGenerated({});
    setLoadingKit(true);
    try {
      const result = await getJobKitFn({ job: { id: job.id, title: job.title, company: job.company } });
      const kit = result.data.kit || {};
      const saved = {};
      if (kit.resume) saved.resume = kit.resume;
      if (kit.cover_letter) saved.cover_letter = kit.cover_letter;
      if (kit.cold_email) saved.cold_email = kit.cold_email;
      setGenerated(saved);
    } catch (err) {
      console.warn("Could not load saved kit:", err);
    } finally {
      setLoadingKit(false);
    }
  }, []);

  const generateDoc = useCallback(async (jobData, docType, isRegenerate = false) => {
    if (isRegenerate) {
      track("doc_regenerate", { doc_type: docType });
    } else {
      track("doc_generate_start", { doc_type: docType });
    }
    setLoading(true);
    try {
      const result = await generateDocumentFn({ job: jobData, profile, documentType: docType });
      setGenerated((prev) => ({ ...prev, [docType]: result.data.content }));
      if (result.data.needsResumeReupload) {
        setNeedsResumeReupload(true);
      } else if (result.data.usedResumeText) {
        setNeedsResumeReupload(false);
      }
      await onProfileUpdate();
      await refreshKitCount();
      track("doc_generate_success", { doc_type: docType });
    } catch (err) {
      if (shouldPromptUpgrade(err)) {
        track("free_limit_reached", { action: "kit" });
        openUpgrade(upgradeReasonFromError(err));
        return;
      }
      track("doc_generate_failure", { doc_type: docType, error_code: errorCodeFromErr(err) });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile, onProfileUpdate, openUpgrade, refreshKitCount]);

  const handleUpgrade = async (plan) => {
    track("upgrade_click", { plan });
    track("checkout_start", { plan });
    setProcessingPayment(true);
    try {
      const result = await createCheckoutFn({ plan });
      const checkout = result.data;
      await openRazorpaySubscriptionCheckout(checkout, {
        onSuccess: async (response) => {
          try {
            await verifyRazorpaySubscriptionFn({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              plan: checkout.plan,
            });
            await onProfileUpdate();
            onShowProBanner?.();
            setShowUpgrade(false);
            const isWeekly = checkout.plan === "weekly" || checkout.plan === "week";
            track("checkout_return", { status: "success", plan: isWeekly ? "weekly" : "monthly" });
            track("purchase_success", {
              plan: isWeekly ? "weekly" : "monthly",
              value: isWeekly ? PRO_PRICING.weekly.amount : PRO_PRICING.monthly.amount,
              currency: PRO_PRICING.currency,
            });
          } catch (verifyErr) {
            alert(callableErrorMessage(verifyErr) || "Payment received but verification failed. Pro will unlock shortly via webhook.");
          }
        },
      });
    } catch (err) {
      const msg = err?.message || "";
      if (!/cancelled/i.test(msg)) {
        alert(msg || "Payment setup failed");
      }
    }
    setProcessingPayment(false);
  };

  if (profileLoading && !userProfile) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.bg }}>
        <Spinner size={36} />
        <p style={{ color: C.sub, fontSize: 14 }}>Setting up your account…</p>
      </div>
    );
  }

  if (profileError && !userProfile) {
    return (
      <div style={{ minHeight: "100svh", padding: 40, textAlign: "center" }}>
        <p style={{ color: C.red, marginBottom: 16, fontSize: 14 }}>{profileError}</p>
        <button type="button" onClick={onProfileUpdate} style={{ padding: "12px 24px", borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 600 }}>Retry</button>
        <button type="button" onClick={handleLogout} style={{ display: "block", margin: "16px auto", color: C.sub, fontSize: 13 }}>Logout</button>
      </div>
    );
  }

  return (
    <AppShell
      screen={screen}
      onNavigate={setScreen}
      onLogout={handleLogout}
      onOpenDataPrivacy={() => {
        setDeleteDataError("");
        setDataPrivacyOpen(true);
      }}
      hasProfile={hasSavedProfile}
      hasJobs={jobs.length > 0}
      isPro={isPro}
      userEmail={auth.currentUser?.email || ""}
      kitCount={kitCount}
    >
      <HelpFaqContextSync screen={screen} showUpgrade={showUpgrade} />
      <DataPrivacyModal
        open={dataPrivacyOpen}
        onClose={() => !deletingData && setDataPrivacyOpen(false)}
        onDeleteResume={handleDeleteResumeData}
        onDeleteAccount={handleDeleteAccount}
        loading={deletingData}
        error={deleteDataError}
      />
      {showProBanner && <CheckoutSuccessBanner onDismiss={onDismissProBanner} />}
      {showUpgrade && (
        <UpgradeModal
          reason={upgradeReason}
          onUpgrade={handleUpgrade}
          onClose={() => setShowUpgrade(false)}
          processing={processingPayment}
        />
      )}

      {screen === "resume" && (
        <div key="resume" className="screen-view">
        <ResumeScreen
          isPro={isPro}
          loading={loading}
          hasExistingProfile={hasSavedProfile}
          uploadLimitReached={!isPro && uploadsUsed >= 1}
          onPromptUpgrade={openUpgrade}
          onUpload={uploadResume}
          onCancel={hasSavedProfile ? () => setScreen("filters") : undefined}
          onLogout={handleLogout}
        />
        </div>
      )}
      {screen === "filters" && (
        <div key="filters" className="screen-view">
        <FiltersScreen
          profile={profile}
          isPro={isPro}
          searchLimitReached={!isPro && searchesUsed >= 1}
          loading={searchLoading}
          onSearch={searchJobs}
          onPromptUpgrade={openUpgrade}
          onUpdateResume={() => setScreen("resume")}
          onLogout={handleLogout}
        />
        </div>
      )}
      {screen === "jobs" && (
        <div key="jobs" className="screen-view">
        <JobsScreen
          key={jobsListKey}
          jobs={jobs}
          loading={searchLoading}
          currencySymbol={currencySymbol}
          hasMoreApi={jobsMeta.hasMoreApi}
          loadingMoreApi={loadingMoreJobs}
          onLoadMoreApi={loadMoreJobsFromApi}
          datePostedNotice={jobsMeta.datePostedNotice}
          jsearchStats={jobsMeta.jsearchStats}
          kitJobId={userProfile?.applicationKit?.kitKey || userProfile?.applicationKit?.jobId}
          isPro={isPro}
          onSelectJob={openJobDetail}
          onBack={() => setScreen("filters")}
          onLogout={handleLogout}
        />
        </div>
      )}
      {screen === "kit" && (
        <div key="kit" className="screen-view">
        <ApplicationKitScreen
          profile={profile}
          isPro={isPro}
          kitUsed={kitUsed}
          currencySymbol={currencySymbol}
          onNavigateToJobs={() => setScreen(jobs.length > 0 ? "jobs" : "filters")}
          onKitCountChange={setKitCount}
          onPromptUpgrade={openUpgrade}
          onProfileUpdate={onProfileUpdate}
          onLogout={handleLogout}
          cache={kitScreenCache}
          onCacheChange={setKitScreenCache}
        />
        </div>
      )}
      {screen === "detail" && selectedJob && (
        <div key="detail" className="screen-view">
        <JobDetailScreen
          job={selectedJob}
          currencySymbol={currencySymbol}
          loading={loading}
          loadingKit={loadingKit}
          generated={generated}
          needsResumeReupload={needsResumeReupload || userProfile?.hasStoredResumeText === false}
          onUpdateResume={() => setScreen("resume")}
          onGenerateDoc={generateDoc}
          onBack={() => setScreen("jobs")}
          onLogout={handleLogout}
          isPro={isPro}
          kitUsed={kitUsed}
          kitJobId={userProfile?.applicationKit?.kitKey || userProfile?.applicationKit?.jobId}
          onPromptUpgrade={openUpgrade}
        />
        </div>
      )}
    </AppShell>
  );
};

// ─── Resume ──────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

const ResumeScreen = ({ isPro, loading, hasExistingProfile, uploadLimitReached, onPromptUpgrade, onUpload, onCancel, onLogout }) => {
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      if (file.size > 5 * 1024 * 1024) {
        alert("PDF must be smaller than 5 MB.");
        return;
      }
      setPdfFile(file);
      setText("");
      return;
    }

    setPdfFile(null);
    const reader = new FileReader();
    reader.onload = (e) => setText(String(e.target?.result || ""));
    reader.readAsText(file);
  };

  const canSubmit = pdfFile || text.trim().length >= 50;

  const handleSubmit = () => {
    if (uploadLimitReached) {
      onPromptUpgrade(UPGRADE_MESSAGES.upload);
      return;
    }
    onUpload({ text, pdfFile });
  };

  return (
    <PageMain variant="form">
      <MobileOnly>
        <Header
          title={hasExistingProfile ? "Update resume" : "Upload resume"}
          subtitle="Upload a PDF or paste your resume to build your job search profile."
          onLogout={onLogout}
        />
        {!hasExistingProfile && <StepProgress current="resume" />}
      </MobileOnly>
      <PageTitle
        title={hasExistingProfile ? "Update resume" : "Upload resume"}
        subtitle="Upload a PDF or paste your resume to build your job search profile."
      />
      <SecurityBanner />
      {isPro && <ProBadge />}

      {isPro && hasExistingProfile ? (
        <div style={{ ...cardStyle, padding: 14, marginBottom: 16, fontSize: 13, color: C.success, lineHeight: 1.55, borderColor: `${C.success}33`, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <IconCheck size={16} color={C.success} />
          <span>You already have a saved profile. Upload a new resume to change your job title, skills, or summary.</span>
        </div>
      ) : hasExistingProfile ? (
        <div style={{ ...cardStyle, padding: 14, marginBottom: 16, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Free plan:</strong> 1 resume upload per month{uploadLimitReached ? " — you've used yours this month" : ". You can replace your profile once this month"}.
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 14, marginBottom: 16, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Free plan:</strong> 1 new profile/month. Upload a PDF or .txt, or paste text below.
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          width: "100%",
          padding: 24,
          borderRadius: 14,
          background: C.surface,
          border: `2px dashed ${C.border}`,
          color: C.sub,
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <IconUpload size={24} color={C.accent} />
        <span style={{ color: C.text, fontWeight: 600 }}>Upload PDF or .txt resume</span>
        <span style={{ fontSize: 12, color: C.muted }}>Max 5 MB · text-based PDFs work best</span>
      </button>

      {pdfFile && (
        <div style={{ background: C.greenGlow, border: `1px solid ${C.success}33`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: C.success, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><IconCheck size={14} /> {pdfFile.name}</span>
          <button type="button" onClick={() => setPdfFile(null)} style={{ color: C.sub, fontSize: 12 }}>Remove</button>
        </div>
      )}

      <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 10 }}>— or paste below —</p>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (e.target.value) setPdfFile(null); }}
        placeholder="Paste your full resume here (name, experience, skills, education)..."
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, fontSize: 14, resize: "vertical", minHeight: 200, lineHeight: 1.6, marginBottom: 16, boxShadow: C.shadowSm }}
      />

      <button type="button" onClick={handleSubmit} disabled={loading || !canSubmit} style={primaryBtnStyle(loading || !canSubmit)}>
        {loading ? <><Spinner size={18} color="#fff" /> {pdfFile ? "Reading PDF…" : "Parsing…"}</> : "Parse resume"}
      </button>

      {onCancel && (
        <button type="button" onClick={onCancel} style={{ ...outlineBtnStyle, marginTop: 12 }}>
          Back to saved profile
        </button>
      )}
    </PageMain>
  );
};

// ─── Filters ─────────────────────────────────────────────────────────────────

const DATE_POSTED_OPTIONS = [
  { id: "week", label: "Past week (recommended)" },
  { id: "24h", label: "Last 24 hours" },
  { id: "month", label: "Past month" },
];

const FiltersScreen = ({ profile, isPro, searchLimitReached, loading, onSearch, onPromptUpgrade, onUpdateResume, onLogout }) => {
  const [workplace, setWorkplace] = useState(["Remote", "Hybrid", "On-site"]);
  const [salary, setSalary] = useState([40, 150]);
  const [jobType, setJobType] = useState(["Full-time", "Part-time"]);
  const [datePosted, setDatePosted] = useState("week");
  const [region, setRegion] = useState(REGIONS[0]);
  const [cities, setCities] = useState([]);
  const topCities = TOP_CITIES_BY_REGION[region.label] || [];
  const isIndia = region.label === "India";
  const salaryMin = isIndia ? 3 : 20;
  const salaryMax = isIndia ? 60 : 250;

  useEffect(() => {
    setSalary(isIndia ? [6, 25] : [40, 150]);
  }, [isIndia]);

  useEffect(() => {
    setCities([]);
  }, [region.label]);

  return (
    <PageMain variant="full">
      <div className="filters-screen-header">
        <MobileOnly>
          <Header
            title="Search jobs"
            subtitle="Set filters to find roles that match your profile."
            onLogout={onLogout}
          />
          <StepProgress current="filters" />
        </MobileOnly>
        <PageTitle title="Search jobs" subtitle="Set filters to find roles that match your profile." />
      </div>

      <div className="filters-screen-content">
      <div className="filters-layout">
        <div className="filters-sidebar-col">
          {profile && (
            <div style={{ ...cardStyle, padding: 16, marginBottom: 0 }}>
              <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <IconCheck size={14} color={C.success} /> Saved profile — ready to search
              </div>
              {profile.name && <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{profile.name}</div>}
              <div style={{ fontWeight: 600, marginTop: profile.name ? 4 : 0, color: C.accent }}>{profile.title}</div>
              {profile.experience_years != null && (
                <div style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>{profile.experience_years} years experience</div>
              )}
              {profile.summary && (
                <p style={{ fontSize: 13, color: C.sub, marginTop: 10, lineHeight: 1.55 }}>{profile.summary}</p>
              )}
              {(profile.skills || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {profile.skills.slice(0, 8).map((skill) => (
                    <span key={skill} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: C.accentSoft, color: C.accent, fontWeight: 500 }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isPro && (
            <div className={`filters-screen-notice${searchLimitReached ? " filters-screen-notice--warning" : " filters-screen-notice--info"}`}>
              {searchLimitReached ? (
                <>
                  {UPGRADE_MESSAGES.search} You can still open past results and your application kit.
                  <button
                    type="button"
                    onClick={() => onPromptUpgrade(UPGRADE_MESSAGES.search)}
                    style={{ display: "block", marginTop: 10, width: "100%", padding: 10, borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13 }}
                  >
                    Upgrade to Pro
                  </button>
                </>
              ) : (
                "Free plan: 1 job search this month — then generate one tailored document (resume, cover letter, or email)."
              )}
            </div>
          )}
        </div>

        <div className="filters-main-col">
          <div className="filters-grid stagger-children">
            <FilterSection label="Workplace">
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Select one or more</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Remote", "Hybrid", "On-site"].map((w) => (
                  <Chip
                    key={w}
                    label={w}
                    active={workplace.includes(w)}
                    onClick={() => setWorkplace((prev) => toggleMultiSelect(prev, w))}
                    icon={w === "Remote" ? IconHome : IconBuilding}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection label="Country">
              <select
                value={region.label}
                onChange={(e) => setRegion(REGIONS.find((r) => r.label === e.target.value))}
                style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 14 }}
              >
                {REGIONS.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.flag} {r.label}
                  </option>
                ))}
              </select>
              {topCities.length > 0 && (
                <>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 12, marginBottom: 10 }}>
                    Top cities — optional. Select one or more, or search the whole country.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {topCities.map((city) => (
                      <Chip
                        key={city}
                        label={city}
                        active={cities.includes(city)}
                        onClick={() => setCities((prev) => toggleOptionalMultiSelect(prev, city))}
                      />
                    ))}
                  </div>
                </>
              )}
            </FilterSection>

            <FilterSection label="Job Type">
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Select one or more</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Full-time", "Part-time"].map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={jobType.includes(t)}
                    onClick={() => setJobType((prev) => toggleMultiSelect(prev, t))}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection label="Posted">
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Newest first. If 24h has few results, we include the past week automatically.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DATE_POSTED_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={datePosted === opt.id}
                    onClick={() => setDatePosted(opt.id)}
                    icon={opt.id === "24h" ? IconClock : undefined}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection label={isIndia ? "Salary (₹ LPA — lakhs per year)" : `Salary (${region.symbol}/yr, thousands)`} fullWidth>
              <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                {isIndia ? `₹${salary[0]}–${salary[1]} LPA` : `${region.symbol}${salary[0]}k → ${region.symbol}${salary[1]}k`}
              </div>
              <input type="range" min={salaryMin} max={salaryMax} value={salary[0]} onChange={(e) => setSalary([+e.target.value, Math.max(+e.target.value + (isIndia ? 2 : 10), salary[1])])} style={{ width: "100%", accentColor: C.accent, marginBottom: 8 }} />
              <input type="range" min={salaryMin} max={salaryMax} value={salary[1]} onChange={(e) => setSalary([Math.min(salary[0], +e.target.value - (isIndia ? 2 : 10)), +e.target.value])} style={{ width: "100%", accentColor: C.accent }} />
            </FilterSection>
          </div>

          <p style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Listings via JSearch · LinkedIn, Indeed, and other major boards</p>

          <div className="filters-actions">
            <button
              type="button"
              onClick={() => {
                if (searchLimitReached) {
                  onPromptUpgrade(UPGRADE_MESSAGES.search);
                  return;
                }
                onSearch({ workplace, salary, jobType, datePosted, region, cities });
              }}
              disabled={loading}
              style={primaryBtnStyle(loading)}
            >
              {loading ? (
                <>
                  <Spinner size={18} color="#fff" /> Searching job boards and ranking matches…
                </>
              ) : searchLimitReached ? (
                "Upgrade to search again"
              ) : (
                <>
                  <IconSearch size={18} color="#fff" /> Search jobs
                </>
              )}
            </button>
            {loading && (
              <p className="filters-loading-note" style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
                Checking listings across LinkedIn, Indeed and more, then scoring fit to your resume. This can take up to ~20-40 seconds.
              </p>
            )}
            <button type="button" onClick={onUpdateResume} style={outlineBtnStyle}>
              Update resume / change profile
            </button>
          </div>
        </div>
      </div>
      </div>
    </PageMain>
  );
};

// ─── Application kit library ─────────────────────────────────────────────────

const ApplicationKitScreen = ({
  profile,
  isPro,
  kitUsed,
  currencySymbol = "$",
  onNavigateToJobs,
  onKitCountChange,
  onPromptUpgrade,
  onProfileUpdate,
  onLogout,
  cache,
  onCacheChange,
}) => {
  const [kitList, setKitList] = useState(() => cache?.kitList || []);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedKey, setSelectedKey] = useState(() => cache?.selectedKey || null);
  const [generated, setGenerated] = useState(() => cache?.generated || {});
  const [jobSnapshot, setJobSnapshot] = useState(() => cache?.jobSnapshot || null);
  const [applyUrl, setApplyUrl] = useState(() => cache?.applyUrl || "");
  const [loadedKitKey, setLoadedKitKey] = useState(() => cache?.loadedKitKey || null);
  const [loadingKit, setLoadingKit] = useState(false);
  const [loadingGen, setLoadingGen] = useState(false);
  const [genError, setGenError] = useState("");
  const [tab, setTab] = useState(() => cache?.tab || "resume");
  const [mobileShowViewer, setMobileShowViewer] = useState(() => cache?.mobileShowViewer || false);

  const selectedKit = kitList.find((k) => (k.kitKey || k.jobKey) === selectedKey) || null;

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const result = await listJobKitsFn();
      const kits = result.data?.kits || [];
      setKitList(kits);
      onKitCountChange?.(kits.length);
      track("kit_library_open", { kit_count: kits.length });
      if (kits.length > 0) {
        setSelectedKey((prev) => prev || kits[0].kitKey || kits[0].jobKey);
      }
    } catch (err) {
      setListError(callableErrorMessage(err));
    } finally {
      setLoadingList(false);
    }
  }, [onKitCountChange]);

  useEffect(() => {
    const hasCachedList = Array.isArray(cache?.kitList) && cache.kitList.length > 0;
    if (hasCachedList) {
      setLoadingList(false);
      onKitCountChange?.(cache.kitList.length);
      return;
    }
    loadList();
  }, [cache?.kitList, loadList, onKitCountChange]);

  useEffect(() => {
    onCacheChange?.({
      kitList,
      selectedKey,
      loadedKitKey,
      generated,
      jobSnapshot,
      applyUrl,
      tab,
      mobileShowViewer,
    });
  }, [kitList, selectedKey, loadedKitKey, generated, jobSnapshot, applyUrl, tab, mobileShowViewer, onCacheChange]);

  useEffect(() => {
    const kit = kitList.find((k) => (k.kitKey || k.jobKey) === selectedKey);
    if (!kit) return undefined;
    if (selectedKey && selectedKey === loadedKitKey) {
      return undefined;
    }
    let cancelled = false;
    setLoadingKit(true);
    setGenerated({});
    setJobSnapshot(null);
    setApplyUrl("");
    setGenError("");
    getJobKitFn({ kitKey: kit.kitKey || kit.jobKey })
      .then((result) => {
        if (cancelled) return;
        const k = result.data?.kit || {};
        const saved = {};
        if (k.resume) saved.resume = k.resume;
        if (k.cover_letter) saved.cover_letter = k.cover_letter;
        if (k.cold_email) saved.cold_email = k.cold_email;
        setGenerated(saved);
        setLoadedKitKey(kit.kitKey || kit.jobKey);
        setJobSnapshot(result.data?.jobSnapshot || snapshotToJob({
          title: result.data?.jobTitle,
          company: result.data?.company,
          location: result.data?.location,
          workplace: result.data?.workplace,
          posted: result.data?.posted,
          apply_url: result.data?.applyUrl,
        }));
        setApplyUrl(result.data?.applyUrl || kit.applyUrl || "");
      })
      .catch((err) => {
        if (!cancelled) console.warn("Could not load kit:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingKit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKey, kitList, loadedKitKey]);

  const regenerateDoc = async (docType) => {
    if (!isPro && kitUsed) {
      track("free_limit_reached", { action: "kit" });
      onPromptUpgrade(UPGRADE_MESSAGES.kit);
      return;
    }
    const jobPayload = snapshotToJob(jobSnapshot);
    if (!jobPayload?.title) {
      setGenError("Job details missing — cannot regenerate this document.");
      return;
    }
    track(isPro ? "doc_regenerate" : "doc_generate_start", { doc_type: docType });
    setLoadingGen(true);
    setGenError("");
    try {
      const result = await generateDocumentFn({ job: jobPayload, profile, documentType: docType });
      setGenerated((prev) => ({ ...prev, [docType]: result.data.content }));
      const kitResult = await getJobKitFn({ kitKey: selectedKey });
      const k = kitResult.data?.kit || {};
      setGenerated({
        ...(k.resume ? { resume: k.resume } : {}),
        ...(k.cover_letter ? { cover_letter: k.cover_letter } : {}),
        ...(k.cold_email ? { cold_email: k.cold_email } : {}),
      });
      if (kitResult.data?.jobSnapshot) setJobSnapshot(kitResult.data.jobSnapshot);
      await loadList();
      await onProfileUpdate?.();
      track("doc_generate_success", { doc_type: docType });
    } catch (err) {
      if (shouldPromptUpgrade(err)) {
        track("free_limit_reached", { action: "kit" });
        onPromptUpgrade(upgradeReasonFromError(err));
      } else {
        track("doc_generate_failure", { doc_type: docType, error_code: errorCodeFromErr(err) });
        setGenError(callableErrorMessage(err));
      }
    } finally {
      setLoadingGen(false);
    }
  };

  const selectKit = (kit) => {
    setSelectedKey(kit.kitKey || kit.jobKey);
    setTab("resume");
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileShowViewer(true);
    }
  };

  const docBadges = (kit) => (
    <div className="kit-library-item__badges">
      {kit.hasResume && (
        <span style={{ fontSize: 10, fontWeight: 600, color: C.success, background: C.greenGlow, padding: "2px 8px", borderRadius: 100 }}>Resume</span>
      )}
      {kit.hasCoverLetter && (
        <span style={{ fontSize: 10, fontWeight: 600, color: C.success, background: C.greenGlow, padding: "2px 8px", borderRadius: 100 }}>Cover</span>
      )}
      {kit.hasEmail && (
        <span style={{ fontSize: 10, fontWeight: 600, color: C.success, background: C.greenGlow, padding: "2px 8px", borderRadius: 100 }}>Email</span>
      )}
    </div>
  );

  return (
    <PageMain variant="full">
      <div className="kit-screen-header">
        <MobileOnly>
          <Header
            title="Application kit"
            subtitle="All your saved resumes, cover letters, and emails."
            onLogout={onLogout}
          />
        </MobileOnly>
        <PageTitle title="Application kit" subtitle="All your saved resumes, cover letters, and emails." />
      </div>

      <div className="kit-screen-content">
      {loadingList ? (
        <div className="kit-screen-body kit-screen-body--loading">
          <Spinner /> Loading saved kits…
        </div>
      ) : listError ? (
        <div className="kit-screen-body">
          <div className="kit-screen-panel" style={{ textAlign: "center" }}>
            <p style={{ color: C.red, marginBottom: 12 }}>{listError}</p>
            <button type="button" onClick={loadList} style={outlineBtnStyle}>Retry</button>
          </div>
        </div>
      ) : kitList.length === 0 ? (
        <div className="kit-screen-body">
          <div className="kit-screen-panel" style={{ textAlign: "center" }}>
            <p style={{ color: C.text, fontWeight: 600, marginBottom: 8 }}>No application kits yet</p>
            <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Search jobs and open a listing to generate your tailored resume, cover letter, and email.
            </p>
            <button type="button" onClick={onNavigateToJobs} style={primaryBtnStyle()}>
              <IconSearch size={18} color="#fff" /> Go to job search
            </button>
          </div>
        </div>
      ) : (
        <div className="kit-library-layout">
          <div className={`kit-library-list${mobileShowViewer ? " kit-library-list--mobile-hidden" : ""}`}>
            {kitList.map((kit) => (
              <button
                key={kit.kitKey || kit.jobKey}
                type="button"
                className={`kit-library-item${selectedKey === (kit.kitKey || kit.jobKey) ? " kit-library-item--active" : ""}`}
                onClick={() => selectKit(kit)}
              >
                <div className="kit-library-item__title">{kit.jobTitle}</div>
                {kit.company && <div className="kit-library-item__company">{kit.company}</div>}
                {kit.location && <div className="kit-library-item__location">{kit.location}</div>}
                {kit.updatedAt && (
                  <div className="kit-library-item__date">{formatKitDate(kit.updatedAt)}</div>
                )}
                {docBadges(kit)}
              </button>
            ))}
          </div>

          <div className={`kit-library-viewer${mobileShowViewer ? "" : " kit-library-viewer--mobile-hidden"}`}>
            <MobileOnly>
              <button
                type="button"
                onClick={() => setMobileShowViewer(false)}
                style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16, padding: 0 }}
              >
                ← All kits
              </button>
            </MobileOnly>
            {selectedKit && (
              <>
                <JobSnapshotCard snapshot={jobSnapshot} applyUrl={applyUrl} currencySymbol={currencySymbol} />
                <KitDocumentViewer
                  generated={generated}
                  tab={tab}
                  onTabChange={setTab}
                  loadingKit={loadingKit}
                  loadingGen={loadingGen}
                  genError={genError}
                  readOnly={false}
                  isPro={isPro}
                  canGenerate={Boolean(profile?.title) && (isPro || !kitUsed)}
                  onGenerate={regenerateDoc}
                  onRegenerate={isPro ? regenerateDoc : undefined}
                  onPromptUpgrade={() => onPromptUpgrade(UPGRADE_MESSAGES.kit)}
                  upgradeMessage={UPGRADE_MESSAGES.kit}
                  freeTierNote={
                    !isPro
                      ? kitUsed
                        ? "You've used your free generation this month. Upgrade to Pro to generate or regenerate."
                        : "Free: one document generation per month (copy text only). Pro: download resume as PDF."
                      : ""
                  }
                  applyUrl={applyUrl}
                  jobSource={jobSnapshot?.source}
                  jobTitle={selectedKit.jobTitle}
                  company={selectedKit.company}
                />
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </PageMain>
  );
};

// ─── Jobs list ───────────────────────────────────────────────────────────────

const JOBS_PER_PAGE = 10;

const JobsScreen = ({
  jobs,
  loading,
  currencySymbol,
  hasMoreApi,
  loadingMoreApi,
  onLoadMoreApi,
  datePostedNotice,
  jsearchStats,
  kitJobId,
  isPro,
  onSelectJob,
  onBack,
  onLogout,
}) => {
  const jsearchRaw = jsearchStats?.rawCount ?? null;
  const apiReturnedNothing = jsearchRaw === 0;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * JOBS_PER_PAGE;
  const pageJobs = jobs.slice(start, start + JOBS_PER_PAGE);
  const showingEnd = Math.min(start + JOBS_PER_PAGE, jobs.length);

  return (
    <PageMain variant="full">
      <div className="jobs-screen-header">
        <MobileOnly>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: 1 }}>
              <MobileNavToggle style={{ marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Job listings</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
                  {loading && jobs.length === 0
                    ? "Searching job boards + scoring matches for your profile…"
                    : `${jobs.length} jobs · newest first · page ${safePage} of ${totalPages}`}
                </div>
              </div>
            </div>
            <LogoutBtn onLogout={onLogout} />
          </div>
          <StepProgress current="jobs" />
        </MobileOnly>
        <PageTitle
          title="Job listings"
          subtitle={
            loading && jobs.length === 0
              ? "Searching job boards + ranking results for your resume…"
              : `${jobs.length} jobs · newest first · page ${safePage} of ${totalPages}`
          }
        />
      </div>

      <div className="jobs-screen-content">
        {(datePostedNotice || (jsearchRaw != null && jobs.length > 0 && jobs.length < 8) || !isPro) && (
          <div className="jobs-screen-notices">
            {!isPro && (
              <p className="jobs-screen-notice jobs-screen-notice--info">
                Browse any job. Free plan: <strong>one document generation</strong> per month (any job).
              </p>
            )}
            {datePostedNotice && (
              <p className="jobs-screen-notice jobs-screen-notice--amber">{datePostedNotice}</p>
            )}
            {jsearchRaw != null && jobs.length > 0 && jobs.length < 8 && (
              <p className="jobs-screen-notice jobs-screen-notice--muted">
                Only {jsearchRaw} job{jsearchRaw === 1 ? "" : "s"} found for this search right now. Try a wider date range or different filters.
              </p>
            )}
          </div>
        )}

        <div className="jobs-list-body">
        {loading && jobs.length === 0 ? (
          <JobsListSkeleton />
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: "center", color: C.sub, padding: 40, fontSize: 14, lineHeight: 1.6 }}>
            {apiReturnedNothing ? (
              <>
                No jobs found for this search.<br />
                Try <strong style={{ color: C.text }}>Past month</strong>, a simpler job title, or another country.
              </>
            ) : (
              <>
                {jsearchRaw} job{jsearchRaw === 1 ? "" : "s"} found, but none match your filters.<br />
                Widen salary, date, or workplace options.
              </>
            )}
          </div>
        ) : (
          <>
            {pageJobs.map((job) => {
              const isKitJob = jobMatchesKit(job, kitJobId);
              return (
                <button
                  type="button"
                  key={`${job.id}-${start}`}
                  onClick={() => onSelectJob(job)}
                  className="job-card-btn"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: C.surface,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    border: `1px solid ${isKitJob ? C.accent : C.border}`,
                    boxShadow: C.shadowSm,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: C.accentSoft,
                        color: C.accent,
                        fontWeight: 700,
                        fontSize: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {companyInitial(job.company)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isKitJob && (
                        <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Your generation
                        </span>
                      )}
                      <div className="job-card-title" style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{job.title}</div>
                      <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>{job.company} · {job.location}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {(job.salary_min > 0 || job.salary_max > 0) && (
                          <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>
                            {job.salary_unit === "lpa"
                              ? `₹${job.salary_min}–${job.salary_max} LPA`
                              : `${currencySymbol}${job.salary_min}k–${currencySymbol}${job.salary_max}k`}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: C.muted }}>{job.workplace} · {job.posted}</span>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className="match-badge-pop"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.accent,
                            background: C.accentSoft,
                            padding: "3px 8px",
                            borderRadius: 100,
                          }}
                        >
                          {Math.round(job.match_score)}% match
                        </span>
                        <ProgressBar value={job.match_score} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="desktop-actions">
              <button type="button" onClick={onBack} style={outlineBtnStyle}>
                Back to filters
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ flex: 1, minWidth: 100, padding: 12, borderRadius: 12, background: C.card, color: safePage <= 1 ? C.muted : C.text, fontSize: 13, fontWeight: 600 }}
              >
                ← Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ flex: 1, minWidth: 100, padding: 12, borderRadius: 12, background: C.card, color: safePage >= totalPages ? C.muted : C.text, fontSize: 13, fontWeight: 600 }}
              >
                Next →
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 10 }}>
              Showing {start + 1}–{showingEnd} of {jobs.length}
            </p>

            {hasMoreApi && (
              <button
                type="button"
                onClick={onLoadMoreApi}
                disabled={loadingMoreApi}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 14,
                  borderRadius: 12,
                  border: `1.5px dashed ${C.accent}66`,
                  color: C.accentLight,
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loadingMoreApi ? <><Spinner size={16} /> Loading more…</> : "Load more jobs"}
              </button>
            )}
          </>
        )}
        </div>
      </div>

      <div className="mobile-dock">
        <button type="button" onClick={onBack} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.surface, color: C.text, fontSize: 14, fontWeight: 600, border: `1px solid ${C.border}` }}>Back to filters</button>
      </div>
    </PageMain>
  );
};

// ─── Job detail ──────────────────────────────────────────────────────────────

function stripHtml(html) {
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

function formatApiScalar(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatJobSalary(job, currencySymbol = "$") {
  if (job.salary_min > 0 || job.salary_max > 0) {
    if (job.salary_unit === "lpa") {
      return `₹${job.salary_min}–${job.salary_max} LPA`;
    }
    return `${currencySymbol}${job.salary_min}k–${currencySymbol}${job.salary_max}k / year`;
  }
  const api = job.api || {};
  if (api.job_min_salary == null && api.job_max_salary == null) return null;
  const cur = api.job_salary_currency || "";
  const period = api.job_salary_period ? ` (${api.job_salary_period})` : "";
  const min = api.job_min_salary ?? "—";
  const max = api.job_max_salary ?? "—";
  return `${cur ? `${cur} ` : ""}${min}–${max}${period}`.trim();
}

function jobHasSalary(job) {
  if (job.salary_min > 0 || job.salary_max > 0) return true;
  const api = job.api || {};
  return api.job_min_salary != null || api.job_max_salary != null;
}

const HIDDEN_API_DETAIL_KEYS = new Set([
  "job_apply_link",
  "job_description",
  "job_highlights",
  "job_min_salary",
  "job_max_salary",
  "job_salary_currency",
  "job_salary_period",
]);

const API_FIELD_LABELS = {
  job_id: "Job ID",
  job_title: "Title",
  employer_name: "Employer",
  employer_logo: "Employer logo URL",
  employer_website: "Employer website",
  job_publisher: "Publisher",
  job_employment_type: "Employment type",
  job_apply_link: "Apply link",
  job_apply_is_direct: "Direct apply",
  job_google_link: "Google Jobs link",
  job_description: "Description",
  job_is_remote: "Remote",
  job_workplace_type: "Workplace type",
  job_city: "City",
  job_state: "State",
  job_country: "Country",
  job_latitude: "Latitude",
  job_longitude: "Longitude",
  job_min_salary: "Min salary",
  job_max_salary: "Max salary",
  job_salary_currency: "Salary currency",
  job_salary_period: "Salary period",
  job_benefits: "Benefits",
  job_posted_at: "Posted at",
  job_posted_at_timestamp: "Posted timestamp",
  job_posted_at_datetime_utc: "Posted (UTC)",
  job_offer_expiration_datetime_utc: "Offer expires (UTC)",
  job_highlights: "Highlights",
  job_onet_soc: "O*NET SOC",
  job_onet_job_zone: "O*NET job zone",
  job_occupational_categories: "Occupational categories",
};

const DetailSection = ({ title, children }) => (
  <section style={{ marginBottom: 20 }}>
    <h3 style={{ fontSize: 13, fontWeight: 700, color: C.accentLight, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {title}
    </h3>
    {children}
  </section>
);

const DetailRow = ({ label, value, link }) => (
  <div style={{ marginBottom: 10, fontSize: 13, lineHeight: 1.5 }}>
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
    {link ? (
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: C.accentLight, wordBreak: "break-all" }}>
        {value}
      </a>
    ) : (
      <div style={{ color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</div>
    )}
  </div>
);

const JobApiDetails = ({ job, currencySymbol = "$" }) => {
  const api = job.api || {};
  const description = stripHtml(api.job_description || job.description || "");
  const highlights = api.job_highlights && typeof api.job_highlights === "object" ? api.job_highlights : null;
  const hasSalary = jobHasSalary(job);
  const salaryLabel = formatJobSalary(job, currencySymbol);

  const apiKeys = Object.keys(api).sort().filter((k) => !HIDDEN_API_DETAIL_KEYS.has(k));

  return (
    <div style={{ paddingBottom: 24 }}>
      {api.employer_logo && (
        <img
          src={api.employer_logo}
          alt=""
          style={{ width: 56, height: 56, borderRadius: 12, objectFit: "contain", background: C.card, marginBottom: 12 }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {job.match_score > 0 && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: C.accentGlow, color: C.accentLight }}>
            {job.match_score}% match
          </span>
        )}
        {job.workplace && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: C.card, color: C.sub }}>{job.workplace}</span>
        )}
        {job.employment_type && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: C.card, color: C.sub }}>{job.employment_type}</span>
        )}
        {job.posted && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: C.card, color: C.sub }}>{job.posted}</span>
        )}
        {job.source && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: C.card, color: C.sub }}>{job.source}</span>
        )}
        {hasSalary && salaryLabel && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, background: `${C.green}22`, color: C.green, fontWeight: 600 }}>
            {salaryLabel}
          </span>
        )}
      </div>

      <DetailSection title="Overview">
        <DetailRow label="Location" value={job.location} />
        {hasSalary && salaryLabel && (
          <DetailRow label="Salary" value={salaryLabel} />
        )}
        {api.job_apply_is_direct != null && (
          <DetailRow label="Direct apply" value={formatApiScalar(api.job_apply_is_direct)} />
        )}
        {api.job_is_remote != null && (
          <DetailRow label="Remote" value={formatApiScalar(api.job_is_remote)} />
        )}
        {api.job_workplace_type && (
          <DetailRow label="Workplace type" value={api.job_workplace_type} />
        )}
        {api.employer_website && (
          <DetailRow label="Company website" value={api.employer_website} link={api.employer_website} />
        )}
        {api.job_google_link && (
          <DetailRow label="Google Jobs" value="Open listing" link={api.job_google_link} />
        )}
      </DetailSection>

      {description && (
        <DetailSection title="Description">
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{description}</div>
        </DetailSection>
      )}

      {highlights && Object.keys(highlights).length > 0 && (
        <DetailSection title="Highlights">
          {Object.entries(highlights).map(([section, items]) => (
            <div key={section} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{section}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: C.sub, fontSize: 13, lineHeight: 1.55 }}>
                {(Array.isArray(items) ? items : [items]).filter(Boolean).map((item, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </DetailSection>
      )}

      {api.job_benefits && (
        <DetailSection title="Benefits">
          <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55 }}>
            {Array.isArray(api.job_benefits)
              ? api.job_benefits.map((b, i) => <div key={i}>• {b}</div>)
              : formatApiScalar(api.job_benefits)}
          </div>
        </DetailSection>
      )}

      {apiKeys.length > 0 && (
        <DetailSection title="More details">
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {apiKeys.map((key) => {
              const val = api[key];
              const isUrl = typeof val === "string" && /^https?:\/\//i.test(val);
              return (
                <div key={key} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{API_FIELD_LABELS[key] || key}</div>
                  {isUrl ? (
                    <a href={val} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accentLight, wordBreak: "break-all", display: "block", marginTop: 4 }}>
                      {val}
                    </a>
                  ) : (
                    <pre style={{ fontSize: 12, color: C.text, marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: font }}>
                      {formatApiScalar(val)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </DetailSection>
      )}

      {apiKeys.length === 0 && !description && (
        <p style={{ fontSize: 13, color: C.sub }}>Job details aren’t available. Run a new job search.</p>
      )}
    </div>
  );
};

const JobDetailScreen = ({
  job,
  currencySymbol = "$",
  loading,
  loadingKit,
  generated,
  needsResumeReupload,
  onUpdateResume,
  onGenerateDoc,
  onBack,
  onLogout,
  isPro,
  kitUsed,
  kitJobId,
  onPromptUpgrade,
}) => {
  const [mainView, setMainView] = useState("details");
  const salaryLabel = formatJobSalary(job, currencySymbol);
  const isKitJob = jobMatchesKit(job, kitJobId);
  const canGenerate = isPro || !kitUsed;
  const [tab, setTab] = useState("resume");
  const [genError, setGenError] = useState("");

  const freeTierNote = !isPro
    ? canGenerate
      ? "Free: one document generation per month (copy text). Pro: full ATS resume PDF download."
      : isKitJob
        ? "You've used your free generation this month. View your saved document or upgrade to Pro."
        : "You've used your free generation this month. Upgrade to Pro for more."
    : "";

  const requestDoc = async (docType) => {
    if (generated[docType]) return;
    if (!canGenerate) {
      onPromptUpgrade(UPGRADE_MESSAGES.kit);
      return;
    }
    setGenError("");
    try {
      await onGenerateDoc(job, docType);
    } catch (err) {
      if (shouldPromptUpgrade(err)) {
        onPromptUpgrade(upgradeReasonFromError(err));
        return;
      }
      setGenError(callableErrorMessage(err));
    }
  };

  const regenerateDoc = async (docType) => {
    if (!isPro) {
      onPromptUpgrade(UPGRADE_MESSAGES.kit);
      return;
    }
    setGenError("");
    try {
      await onGenerateDoc(job, docType, true);
    } catch (err) {
      if (shouldPromptUpgrade(err)) {
        onPromptUpgrade(upgradeReasonFromError(err));
        return;
      }
      setGenError(callableErrorMessage(err));
    }
  };

  useEffect(() => {
    if (loadingKit) return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop && mainView !== "kit") return;
    if (canGenerate && !generated[tab]) requestDoc(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canGenerate, mainView, loadingKit]);

  const kitPanel = (
    <KitDocumentViewer
      generated={generated}
      tab={tab}
      onTabChange={setTab}
      loadingKit={loadingKit}
      loadingGen={loading}
      genError={genError}
      isPro={isPro}
      canGenerate={canGenerate}
      onGenerate={requestDoc}
      onRegenerate={isPro ? regenerateDoc : undefined}
      onPromptUpgrade={() => onPromptUpgrade(UPGRADE_MESSAGES.kit)}
      upgradeMessage={UPGRADE_MESSAGES.kit}
      freeTierNote={freeTierNote}
      applyUrl={job.apply_url}
      jobSource={job.source}
      jobTitle={job.title}
      company={job.company}
    />
  );

  return (
    <PageMain variant="full">
      <div className="detail-header-mobile">
        <MobileOnly>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <MobileNavToggle />
              <button type="button" onClick={onBack} style={{ fontSize: 13, color: C.accent, fontWeight: 600, padding: "4px 0" }}>
                Back to jobs
              </button>
            </div>
            <LogoutBtn onLogout={onLogout} small />
          </div>
        </MobileOnly>
        <PageTitle
          title={job.title}
          subtitle={`${job.company} · ${job.location}${salaryLabel ? ` · ${salaryLabel}` : ""}`}
        />
        <MobileOnly>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, color: C.text }}>{job.title}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, paddingBottom: 12 }}>
            {job.company} · {job.location}
            {salaryLabel && <> · <span style={{ color: C.success }}>{salaryLabel}</span></>}
          </div>
        </MobileOnly>
        <div className="detail-mobile-tabs">
          {[
            { id: "details", label: "Job details" },
            { id: "kit", label: "Application kit" },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setMainView(v.id)}
              style={{
                flex: 1,
                padding: "12px 8px",
                fontSize: 13,
                fontWeight: 600,
                color: mainView === v.id ? C.accent : C.sub,
                borderBottom: mainView === v.id ? `2px solid ${C.accent}` : "2px solid transparent",
                background: "transparent",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="desktop-actions" style={{ marginBottom: 16 }}>
          <button type="button" onClick={onBack} style={outlineBtnStyle}>
            Back to jobs
          </button>
        </div>
      </div>

      {needsResumeReupload && (
        <div className="mobile-inline-alert" style={{ padding: "12px 14px", borderRadius: 12, background: `${C.amber}18`, border: `1px solid ${C.amber}44`, fontSize: 12, color: C.amber, lineHeight: 1.55, maxWidth: 960 }}>
          Upload your resume again for better tailored resume and cover letter.
          <button
            type="button"
            onClick={onUpdateResume}
            style={{ display: "block", marginTop: 10, padding: "8px 12px", borderRadius: 8, background: C.card, color: C.text, fontSize: 12, fontWeight: 600, width: "100%", maxWidth: 200 }}
          >
            Update resume
          </button>
        </div>
      )}

      <div className="detail-body">
        <div className="detail-split">
          <div className={`detail-split__panel${mainView !== "details" ? " detail-panel--mobile-hidden" : ""}`}>
            <h3 className="detail-panel-heading">Job details</h3>
            <JobApiDetails job={job} currencySymbol={currencySymbol} />
          </div>

          <div className={`detail-split__panel${mainView !== "kit" ? " detail-panel--mobile-hidden" : ""}`}>
            <h3 className="detail-panel-heading">Application kit</h3>
            {kitPanel}
          </div>
        </div>
      </div>

      <div className="mobile-dock">
        <button type="button" onClick={onBack} style={{ width: "100%", padding: 10, color: C.sub, fontSize: 13 }}>
          Back to jobs
        </button>
      </div>
    </PageMain>
  );
};

// ─── Upgrade modal ───────────────────────────────────────────────────────────

const FREE_VS_PRO = [
  { feature: "Resume uploads", free: "1/month", pro: "Unlimited" },
  { feature: "Job searches", free: "1/month", pro: "Unlimited" },
  { feature: "Application kits", free: "1 job/month", pro: "Unlimited" },
  { feature: "AI documents", free: "Resume + cover + email", pro: "Same, unlimited" },
];

const UpgradeModal = ({ reason, onUpgrade, onClose, processing }) => {
  const [selectedPlan, setSelectedPlan] = useState("monthly");

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 200,
      }}
    >
      <div
        className="modal-panel"
        style={{
          background: C.surface,
          borderRadius: 20,
          padding: "28px 22px",
          maxWidth: 520,
          width: "100%",
          border: `1px solid ${C.border}`,
          boxShadow: C.shadowLg,
          maxHeight: "90svh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: C.text }}>Upgrade to Pro</h2>
        <p style={{ color: C.sub, fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
          {reason || UPGRADE_MESSAGES.generic}
        </p>

        <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: 16, fontSize: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px", background: C.bg, padding: "10px 12px", fontWeight: 600, color: C.sub }}>
            <span>Feature</span>
            <span>Free</span>
            <span style={{ color: C.accent }}>Pro</span>
          </div>
          {FREE_VS_PRO.map((row) => (
            <div key={row.feature} style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px", padding: "10px 12px", borderTop: `1px solid ${C.border}`, color: C.text }}>
              <span style={{ color: C.sub }}>{row.feature}</span>
              <span>{row.free}</span>
              <span style={{ fontWeight: 600, color: C.accent }}>{row.pro}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSelectedPlan("weekly")}
          style={{
            width: "100%",
            textAlign: "left",
            padding: 16,
            borderRadius: 12,
            marginBottom: 10,
            border: `2px solid ${selectedPlan === "weekly" ? C.accent : C.border}`,
            background: selectedPlan === "weekly" ? C.accentSoft : C.surface,
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Weekly Sprint</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: C.text }}>
            {PRO_PRICING.symbol}{PRO_PRICING.weekly.amount}<span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{PRO_PRICING.weekly.period}</span>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>One intense job-hunt week</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPlan("monthly")}
          style={{
            width: "100%",
            textAlign: "left",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            border: `2px solid ${selectedPlan === "monthly" ? C.accent : C.border}`,
            background: selectedPlan === "monthly" ? C.accentSoft : C.surface,
            position: "relative",
            cursor: "pointer",
          }}
        >
          <span style={{ position: "absolute", top: 10, right: 10, fontSize: 10, fontWeight: 700, color: C.success, background: C.greenGlow, padding: "3px 8px", borderRadius: 100 }}>
            Best value
          </span>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Monthly Pro</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: C.text }}>
            {PRO_PRICING.symbol}{PRO_PRICING.monthly.amount}<span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{PRO_PRICING.monthly.period}</span>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Cheaper than 2 weeks on Weekly</div>
        </button>

        <div style={{ background: C.bg, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <TrustBadge icon={IconCreditCard} text="Secure global checkout via Razorpay" />
          <div style={{ marginTop: 8, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            USD pricing · Major international cards accepted · Cancel anytime
          </div>
        </div>

        <button type="button" onClick={() => onUpgrade(selectedPlan)} disabled={processing} style={primaryBtnStyle(processing)}>
          {processing ? (
            <Spinner size={16} color="#fff" />
          ) : selectedPlan === "weekly" ? (
            PRO_PRICING.weekly.cta
          ) : (
            PRO_PRICING.monthly.cta
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ width: "100%", padding: 12, marginTop: 8, background: "transparent", color: C.sub, fontSize: 14, fontWeight: 500 }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};

// ─── Layout helpers ──────────────────────────────────────────────────────────

const Header = ({ title, subtitle, onLogout }) => (
  <div className="mobile-screen-header">
    <div className="mobile-screen-header__row">
      <div className="mobile-screen-header__main">
        <MobileNavToggle className="mobile-screen-header__menu" />
        <div className="mobile-screen-header__text">
          <h2 className="mobile-screen-header__title">{title}</h2>
          {subtitle && <p className="mobile-screen-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      <LogoutBtn onLogout={onLogout} />
    </div>
  </div>
);

const LogoutBtn = ({ onLogout, small }) => (
  <button type="button" onClick={onLogout} style={{ flexShrink: 0, padding: small ? "6px 12px" : "8px 14px", borderRadius: 10, background: C.surface, color: C.sub, fontSize: small ? 11 : 13, fontWeight: 600, border: `1px solid ${C.border}`, boxShadow: C.shadowSm }}>Logout</button>
);

const ProBadge = () => (
  <div style={{ background: C.greenGlow, border: `1px solid ${C.success}33`, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.success, display: "flex", alignItems: "center", gap: 8 }}>
    <IconCheck size={16} color={C.success} /> Pro member — unlimited access
  </div>
);

// ─── App root ────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProBanner, setShowProBanner] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [authBootstrapping, setAuthBootstrapping] = useState(true);

  const refreshProfile = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setProfileLoading(true);
    setProfileError("");
    try {
      const localProfile = await loadOrCreateUserProfile(firebaseUser);
      setUserProfile(localProfile);

      let merged = localProfile;
      try {
        const { data } = await getUserProfileFn();
        merged = { ...localProfile, ...data };
        setUserProfile(merged);
      } catch (syncErr) {
        console.warn("Profile sync skipped:", syncErr);
      }

      const hasActivity =
        (merged.searches?.count || 0) > 0
        || (merged.resumeUploads?.count || 0) > 0
        || merged.applicationKit?.resume
        || merged.applicationKit?.cover_letter
        || merged.applicationKit?.cold_email;
      try {
        if (hasActivity && !sessionStorage.getItem("no_returning_user")) {
          sessionStorage.setItem("no_returning_user", "1");
          track("returning_user");
        }
      } catch {
        if (hasActivity) track("returning_user");
      }

      identifyUser(firebaseUser.uid, {
        tier: merged.tier || "free",
        has_resume: Boolean(merged.parsedProfile?.title),
        kits_saved: Number(merged.kitCount) || 0,
        signup_week: signupWeekFromDate(merged.createdAt) || "",
      });
      return merged;
    } catch (err) {
      console.error("Profile refresh failed:", err);
      setProfileError(err.message || callableErrorMessage(err) || "Couldn’t load your profile. Try signing in again.");
      setUserProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubAuth = () => {};
    let cancelled = false;

    (async () => {
      setLoading(true);
      setAuthBootstrapping(true);
      try {
        const redirectResult = await bootstrapAuth();
        if (!cancelled && redirectResult?.user) {
          setLoginError("");
        }
      } catch (err) {
        if (!cancelled) {
          const msg = authErrorMessage(err);
          if (msg) setLoginError(msg);
        }
      } finally {
        if (!cancelled) setAuthBootstrapping(false);
      }

      unsubAuth = onAuthStateChanged(auth, (authUser) => {
        if (cancelled) return;
        setUser(authUser);
        if (authUser) {
          setLoginError("");
          setProfileLoading(true);
          authUser
            .getIdToken()
            .then(async () => {
              const merged = await refreshProfile();
              const hasActivity =
                merged
                && ((merged.searches?.count || 0) > 0
                  || (merged.resumeUploads?.count || 0) > 0
                  || merged.applicationKit?.resume
                  || merged.applicationKit?.cover_letter
                  || merged.applicationKit?.cold_email);
              track("sign_in_success", {
                method: "google",
                is_new_user: hasActivity ? 0 : 1,
              });
            })
            .catch((e) => {
              console.error("Auth token error:", e);
              setProfileError("Could not verify sign-in. Please try again.");
              setProfileLoading(false);
            });
        } else {
          clearUser();
          setUserProfile(null);
          setProfileError("");
          setProfileLoading(false);
        }
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, [refreshProfile]);

  const helpBaseContext = useMemo(
    () => ({
      isLoggedIn: Boolean(user),
      isPro: userProfile?.tier === "pro",
      hasResume: Boolean(userProfile?.parsedProfile?.title),
    }),
    [user, userProfile],
  );

  useEffect(() => {
    if (loading || authBootstrapping) return;
    if (user) {
      applyDocumentSeo({
        title: "App — NextOffer.ai",
        noindex: true,
      });
    } else {
      applyDocumentSeo({ noindex: false });
    }
  }, [user, loading, authBootstrapping]);

  if (loading || authBootstrapping) {
    return (
      <div
        style={{
          minHeight: "100svh",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <GlobalStyle />
        <Spinner size={40} />
        <p style={{ color: C.sub, fontSize: 14 }}>
          {authBootstrapping ? "Completing sign in…" : "Loading…"}
        </p>
      </div>
    );
  }

  return (
    <HelpFaqProvider baseContext={helpBaseContext}>
    <div className="app-root">
      <GlobalStyle />
      <CookieConsentBanner />
      <HelpFaqWidget />
      {!user ? (
        <LandingScreen initialError={loginError} />
      ) : (
        <DashboardScreen
          userProfile={userProfile}
          onProfileUpdate={refreshProfile}
          profileLoading={profileLoading}
          profileError={profileError}
          showProBanner={showProBanner}
          onShowProBanner={() => setShowProBanner(true)}
          onDismissProBanner={() => setShowProBanner(false)}
        />
      )}
    </div>
    </HelpFaqProvider>
  );
}

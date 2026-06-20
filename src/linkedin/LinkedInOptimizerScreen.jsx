import { useState, useRef, useEffect } from "react";
import { C, cardStyle, font, PRO_PRICING } from "../theme";
import {
  PageMain,
  PageTitle,
  MobileOnly,
  MobileNavToggle,
  SecurityBanner,
  primaryBtnStyle,
  outlineBtnStyle,
} from "../ui";
import { IconCheck, IconLinkedIn, IconUpload } from "../icons";
import { analyzeLinkedIn as analyzeLinkedInFn, getLinkedInAnalysis as getLinkedInAnalysisFn, generateLinkedInSection as generateLinkedInSectionFn } from "../callable";
import { track } from "../analytics";

function callableErrorMessage(err) {
  return err?.details || err?.message || "Something went wrong. Please try again.";
}

function shouldPromptUpgrade(err) {
  const msg = `${err?.details || ""} ${err?.message || ""}`;
  return (
    /PRO_ONLY:|FREE_LIMIT|resource-exhausted/i.test(msg) ||
    err?.code === "functions/resource-exhausted" ||
    err?.code === "functions/failed-precondition"
  );
}

function upgradeReasonFromError(err) {
  const msg = `${err?.details || ""} ${err?.message || ""}`;
  if (/PRO_ONLY:linkedin|LinkedIn optimiser/i.test(msg)) {
    return "LinkedIn optimiser is a Pro feature. Upgrade to score your profile and generate ready-to-paste improvements.";
  }
  return err?.details || err?.message || "Upgrade to Pro to use LinkedIn optimiser.";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

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

const ScoreBar = ({ value }) => (
  <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 100, overflow: "hidden", minWidth: 0 }}>
    <div
      style={{
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: "100%",
        background: value >= 75 ? C.success : value >= 50 ? C.accent : C.amber,
        borderRadius: 100,
        transition: "width 0.4s ease",
      }}
    />
  </div>
);

function statusLabel(status) {
  if (status === "good") return { text: "Strong", color: C.success };
  if (status === "missing") return { text: "Missing", color: C.red };
  if (status === "weak") return { text: "Weak", color: C.amber };
  return { text: "Needs work", color: C.accent };
}

const GENERATABLE_SECTION_IDS = new Set([
  "headline",
  "about",
  "experience",
  "skills",
  "keywords",
  "featured",
  "recommendations",
]);

function canGenerateSection(section) {
  if (!GENERATABLE_SECTION_IDS.has(section.id)) return false;
  if (section.status === "good" && section.score >= 80) return false;
  return true;
}

function LinkedInScreenHeader({ title, subtitle }) {
  return (
    <div className="linkedin-screen-header">
      <MobileOnly>
        <div className="mobile-screen-header">
          <div className="mobile-screen-header__row">
            <div className="mobile-screen-header__main">
              <div className="mobile-screen-header__menu">
                <MobileNavToggle />
              </div>
              <div className="mobile-screen-header__text">
                <h1 className="mobile-screen-header__title">{title}</h1>
                {subtitle && <p className="mobile-screen-header__subtitle">{subtitle}</p>}
              </div>
            </div>
          </div>
        </div>
      </MobileOnly>
      <PageTitle title={title} subtitle={subtitle} />
    </div>
  );
}

function LinkedInProGate({ onPromptUpgrade }) {
  return (
    <PageMain variant="full">
      <LinkedInScreenHeader
        title="LinkedIn optimiser"
        subtitle="Pro feature — score your profile and generate improvements."
      />
      <div className="linkedin-screen-content">
        <div className="linkedin-pro-gate">
          <div style={{ ...cardStyle, padding: "28px 22px", textAlign: "center", maxWidth: 480, width: "100%" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: C.accentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <IconLinkedIn size={28} color={C.accent} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Pro only</h2>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 20 }}>
              Upload your LinkedIn PDF export for a section-by-section score, gap analysis, and AI-generated headline,
              about, experience, and skills copy — ready to paste.
            </p>
            <ul className="linkedin-pro-gate__list">
              <li>Overall profile score out of 100</li>
              <li>10 sections reviewed with fix suggestions</li>
              <li>Generate improved copy per section</li>
            </ul>
            <button type="button" onClick={() => onPromptUpgrade("LinkedIn optimiser is included with Pro.")} className="btn-premium btn-press" style={{ ...primaryBtnStyle(), marginTop: 8 }}>
              Upgrade to Pro — from {PRO_PRICING.symbol}{PRO_PRICING.weekly.amount}/week
            </button>
          </div>
        </div>
      </div>
    </PageMain>
  );
}

function SectionCard({
  section,
  generatedContent,
  generatedAt,
  generating,
  generationError,
  onGenerate,
  canGenerate,
}) {
  const badge = statusLabel(section.status);
  const [copied, setCopied] = useState(false);
  const showGenerate = canGenerate || Boolean(generatedContent);

  const handleCopy = async () => {
    if (!generatedContent) return;
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Could not copy. Select the text and copy manually.");
    }
  };

  return (
    <article className="linkedin-section-card" style={{ ...cardStyle, padding: 18, marginBottom: 12 }}>
      <div className="linkedin-section-card__head">
        <div className="linkedin-section-card__title-wrap">
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{section.title}</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: badge.color }}>{badge.text}</span>
        </div>
        <div className="linkedin-section-card__score">{section.score}</div>
      </div>
      <div className="linkedin-section-card__bar">
        <ScoreBar value={section.score} />
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, flexShrink: 0 }}>/ 100</span>
      </div>

      {section.findings?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.success, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
            What works
          </div>
          <ul className="linkedin-bullet-list">
            {section.findings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {section.gaps?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
            Gaps
          </div>
          <ul className="linkedin-bullet-list linkedin-bullet-list--amber">
            {section.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {section.suggestions?.length > 0 && (
        <div style={{ marginBottom: showGenerate ? 14 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
            Suggestions
          </div>
          <ul className="linkedin-bullet-list linkedin-bullet-list--accent">
            {section.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {showGenerate && (
        <div className="linkedin-section-generate">
          <div className="linkedin-section-actions">
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="linkedin-btn-inline btn-premium"
              style={primaryBtnStyle(generating)}
            >
              {generating ? (
                <>
                  <Spinner size={16} color="#fff" /> Generating…
                </>
              ) : generatedContent ? (
                "Regenerate"
              ) : (
                "Generate improvement"
              )}
            </button>
            {generatedContent && (
              <button type="button" onClick={handleCopy} className="linkedin-btn-inline" style={outlineBtnStyle} disabled={generating}>
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
          {generationError && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: C.red, lineHeight: 1.5 }}>{generationError}</p>
          )}
          {generatedContent && (
            <div className="linkedin-generated-content">
              {generatedAt && (
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                  Generated {new Date(generatedAt).toLocaleString()}
                </div>
              )}
              <pre>{generatedContent}</pre>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function LinkedInOptimizerScreen({
  isPro,
  onPromptUpgrade,
  onProfileUpdate,
}) {
  const [pdfFile, setPdfFile] = useState(null);
  const [profileText, setProfileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(isPro);
  const [loadError, setLoadError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [sectionGenerations, setSectionGenerations] = useState({});
  const [generatingSection, setGeneratingSection] = useState(null);
  const [sectionGenerationErrors, setSectionGenerationErrors] = useState({});
  const [analyzedAt, setAnalyzedAt] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (!isPro) {
      setLoadingSaved(false);
      return undefined;
    }
    let cancelled = false;
    getLinkedInAnalysisFn()
      .then((result) => {
        if (cancelled) return;
        const data = result.data || {};
        if (data.analysis) {
          setAnalysis(data.analysis);
          setAnalysisId(data.analysisId || null);
          setSectionGenerations(data.sectionGenerations || {});
          setAnalyzedAt(data.analyzedAt || null);
          setFileName(data.fileName || "");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = callableErrorMessage(err);
          if (shouldPromptUpgrade(err)) {
            onPromptUpgrade(upgradeReasonFromError(err));
          } else {
            setLoadError(message);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPro, onPromptUpgrade]);

  if (!isPro) {
    return <LinkedInProGate onPromptUpgrade={onPromptUpgrade} />;
  }

  const handleFile = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("Please upload a PDF exported from LinkedIn.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("PDF must be smaller than 5 MB.");
      return;
    }
    setPdfFile(file);
    setProfileText("");
  };

  const canSubmit = Boolean(pdfFile) || profileText.trim().length >= 50;

  const runAnalysis = async () => {
    if (!canSubmit) return;
    track("linkedin_analysis_start");
    setLoading(true);
    setAnalysisError("");
    try {
      let payload;
      if (pdfFile) {
        payload = {
          linkedinPdfBase64: await fileToBase64(pdfFile),
          fileName: pdfFile.name,
        };
      } else {
        payload = {
          linkedinProfileText: profileText.trim(),
          fileName: "linkedin-profile.txt",
        };
      }
      const result = await analyzeLinkedInFn(payload);
      if (!result.data?.analysis) {
        throw new Error("Analysis completed but no results were returned. Try again.");
      }
      setAnalysis(result.data.analysis);
      setAnalysisId(result.data.analysisId || null);
      setSectionGenerations({});
      setSectionGenerationErrors({});
      setAnalyzedAt(result.data.analyzedAt || new Date().toISOString());
      setFileName(result.data.fileName || pdfFile?.name || "LinkedIn profile");
      setPdfFile(null);
      setProfileText("");
      await onProfileUpdate?.();
      track("linkedin_analysis_success", { overall_score: result.data.analysis?.overall_score });
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      const message = callableErrorMessage(err);
      setAnalysisError(message);
      if (shouldPromptUpgrade(err)) {
        onPromptUpgrade(upgradeReasonFromError(err));
      } else {
        track("linkedin_analysis_failure", { error: message.slice(0, 80) });
      }
    }
    setLoading(false);
  };

  const runSectionGeneration = async (sectionId) => {
    if (!analysisId) {
      setSectionGenerationErrors((prev) => ({
        ...prev,
        [sectionId]: "Run a new analysis first to generate content.",
      }));
      return;
    }
    track("linkedin_section_generate_start", { section_id: sectionId });
    setGeneratingSection(sectionId);
    setSectionGenerationErrors((prev) => ({ ...prev, [sectionId]: "" }));
    try {
      const result = await generateLinkedInSectionFn({ analysisId, sectionId });
      const content = result.data?.content;
      if (!content) {
        throw new Error("No content returned. Try again.");
      }
      setSectionGenerations((prev) => ({
        ...prev,
        [sectionId]: {
          content,
          generatedAt: result.data.generatedAt || new Date().toISOString(),
        },
      }));
      track("linkedin_section_generate_success", { section_id: sectionId });
    } catch (err) {
      const message = callableErrorMessage(err);
      setSectionGenerationErrors((prev) => ({ ...prev, [sectionId]: message }));
      track("linkedin_section_generate_failure", { section_id: sectionId, error: message.slice(0, 80) });
    }
    setGeneratingSection(null);
  };

  const overallScore = analysis?.overall_score ?? 0;

  return (
    <PageMain variant="full">
      <LinkedInScreenHeader
        title="LinkedIn optimiser"
        subtitle="Upload your LinkedIn PDF export for a scored, section-by-section review."
      />

      <div className="linkedin-screen-content">
        <div className="linkedin-optimizer-layout">
          <div className="linkedin-optimizer-upload">
            <SecurityBanner />
            <div style={{ ...cardStyle, padding: 16, marginBottom: 16, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>How to export:</strong> LinkedIn → your profile →{" "}
              <em>More → Save to PDF</em>. Upload that PDF here, or paste your profile text below if the PDF doesn&apos;t read well.
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="linkedin-upload-btn"
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
                fontFamily: font,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                <IconUpload size={18} color={C.accent} />
                <span style={{ wordBreak: "break-word", textAlign: "center" }}>{pdfFile ? pdfFile.name : "Choose LinkedIn PDF"}</span>
              </span>
            </button>

            <p style={{ fontSize: 12, color: C.muted, textAlign: "center", margin: "12px 0" }}>or paste profile text</p>

            <textarea
              value={profileText}
              onChange={(e) => {
                setProfileText(e.target.value);
                if (e.target.value.trim()) setPdfFile(null);
              }}
              placeholder="Paste your LinkedIn headline, about, experience, and skills…"
              rows={6}
              className="linkedin-profile-textarea"
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                fontSize: 13,
                lineHeight: 1.55,
                resize: "vertical",
                marginBottom: 12,
                fontFamily: font,
                boxSizing: "border-box",
              }}
            />

            <button type="button" onClick={runAnalysis} disabled={!canSubmit || loading} style={primaryBtnStyle(!canSubmit || loading)}>
              {loading ? (
                <>
                  <Spinner size={18} color="#fff" /> Analysing profile…
                </>
              ) : (
                "Analyse LinkedIn profile"
              )}
            </button>

            {analysis && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="linkedin-btn-inline"
                style={{ ...outlineBtnStyle, marginTop: 10 }}
                disabled={loading}
              >
                Upload new PDF
              </button>
            )}
          </div>

          <div className="linkedin-optimizer-results" ref={resultsRef}>
            {analysisError && (
              <div style={{ ...cardStyle, padding: 14, marginBottom: 16, borderColor: `${C.red}44`, color: C.red, fontSize: 13, lineHeight: 1.55 }}>
                {analysisError}
              </div>
            )}
            {loadError && !analysis && (
              <div style={{ ...cardStyle, padding: 14, marginBottom: 16, fontSize: 13, color: C.sub, lineHeight: 1.55 }}>
                Could not load a saved analysis ({loadError}). You can still run a new one.
              </div>
            )}
            {loading && !analysis ? (
              <div style={{ ...cardStyle, padding: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.sub, fontSize: 14, flexWrap: "wrap", textAlign: "center" }}>
                <Spinner size={24} /> Analysing your LinkedIn profile… this can take up to a minute.
              </div>
            ) : loadingSaved && !analysis ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub, fontSize: 13 }}>
                <Spinner /> Loading saved analysis…
              </div>
            ) : !analysis ? (
              <div style={{ ...cardStyle, padding: 32, textAlign: "center", color: C.sub, fontSize: 14, lineHeight: 1.6 }}>
                Upload a LinkedIn PDF to get your overall score, gaps, and fix-by-fix suggestions for each profile section.
              </div>
            ) : (
              <>
                <div className="linkedin-overall-card" style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
                  <div className="linkedin-overall-card__inner">
                    <div
                      className="linkedin-overall-score"
                      style={{
                        borderColor: overallScore >= 75 ? C.success : overallScore >= 50 ? C.accent : C.amber,
                      }}
                    >
                      <span className="linkedin-overall-score__value">{overallScore}</span>
                      <span className="linkedin-overall-score__label">/ 100</span>
                    </div>
                    <div className="linkedin-overall-card__meta">
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Overall profile score</div>
                      {fileName && (
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, wordBreak: "break-word" }}>{fileName}</div>
                      )}
                      {analyzedAt && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                          Analysed {new Date(analyzedAt).toLocaleString()}
                        </div>
                      )}
                      <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
                    </div>
                  </div>
                </div>

                {analysis.strengths?.length > 0 && (
                  <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.success, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <IconCheck size={14} color={C.success} /> Strengths
                    </div>
                    <ul className="linkedin-bullet-list">
                      {analysis.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.top_priorities?.length > 0 && (
                  <div style={{ ...cardStyle, padding: 16, marginBottom: 20, borderColor: `${C.amber}55` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 10 }}>Top priorities</div>
                    <ol className="linkedin-priority-list">
                      {analysis.top_priorities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>Section breakdown</h2>
                <p style={{ fontSize: 13, color: C.sub, margin: "0 0 16px", lineHeight: 1.55 }}>
                  On sections that need work, use <strong style={{ color: C.text }}>Generate improvement</strong> for ready-to-paste headline, about, experience, and other copy based on your gaps.
                </p>
                {(analysis.sections || []).map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    canGenerate={canGenerateSection(section)}
                    generatedContent={sectionGenerations[section.id]?.content}
                    generatedAt={sectionGenerations[section.id]?.generatedAt}
                    generating={generatingSection === section.id}
                    generationError={sectionGenerationErrors[section.id]}
                    onGenerate={() => runSectionGeneration(section.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </PageMain>
  );
}

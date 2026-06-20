import { useEffect, useMemo, useState } from "react";
import { C, cardStyle } from "../theme";
import { defaultsFromDashboard, JSEARCH_PLANS, projectMonthlyCosts } from "./costModel";

function SliderField({ label, hint, value, min, max, step, onChange, format }) {
  const display = format ? format(value) : value;
  return (
    <label className="admin-cost-field">
      <div className="admin-cost-field__head">
        <span className="admin-cost-field__label">{label}</span>
        <span className="admin-cost-field__value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="admin-cost-slider"
      />
      {hint && <span className="admin-cost-field__hint">{hint}</span>}
    </label>
  );
}

function CostRow({ label, value, accent, sub }) {
  return (
    <div className="admin-cost-row">
      <div>
        <div className="admin-cost-row__label">{label}</div>
        {sub && <div className="admin-cost-row__sub">{sub}</div>}
      </div>
      <div className="admin-cost-row__value" style={{ color: accent || C.text }}>
        {value}
      </div>
    </div>
  );
}

function PresetButton({ label, active, onClick }) {
  return (
    <button type="button" className={`admin-cost-preset${active ? " admin-cost-preset--active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function CostCalculator({ dashboard }) {
  const defaults = useMemo(() => defaultsFromDashboard(dashboard), [dashboard]);

  const [totalUsers, setTotalUsers] = useState(defaults.totalUsers);
  const [proPercent, setProPercent] = useState(defaults.proPercent);
  const [proHeavyPercent, setProHeavyPercent] = useState(defaults.proHeavyPercent);
  const [proSearchesPerDay, setProSearchesPerDay] = useState(defaults.proSearchesPerDay);
  const [freeActivePercent, setFreeActivePercent] = useState(defaults.freeActivePercent);

  useEffect(() => {
    setTotalUsers(defaults.totalUsers);
    setProPercent(defaults.proPercent);
    setProHeavyPercent(defaults.proHeavyPercent);
    setProSearchesPerDay(defaults.proSearchesPerDay);
    setFreeActivePercent(defaults.freeActivePercent);
  }, [defaults.totalUsers, defaults.proPercent]);

  const projection = useMemo(
    () =>
      projectMonthlyCosts({
        totalUsers,
        proPercent,
        proHeavyPercent,
        proSearchesPerDay,
        freeActivePercent,
      }),
    [totalUsers, proPercent, proHeavyPercent, proSearchesPerDay, freeActivePercent]
  );

  const jsearch = dashboard?.jsearch?.currentMonth || {};
  const ai = dashboard?.ai?.currentMonth || {};
  const actualTotal =
    (ai.estimatedUsd || 0) + (jsearch.estimatedUsd ?? 0) + projection.firebaseUsd;

  return (
    <div className="admin-cost-layout">
      <div className="admin-cost-card">
        <h3 className="admin-cost-title">Scenario inputs</h3>
        <p className="admin-section-note" style={{ marginTop: 0 }}>
          Adjust sliders to model monthly infra cost vs Pro revenue. Pre-filled from live user counts when available.
        </p>

        <div className="admin-cost-presets">
          <PresetButton label="10 users" active={totalUsers === 10} onClick={() => setTotalUsers(10)} />
          <PresetButton label="100 users" active={totalUsers === 100} onClick={() => setTotalUsers(100)} />
          <PresetButton label="1,000 users" active={totalUsers === 1000} onClick={() => setTotalUsers(1000)} />
          <PresetButton
            label="Live count"
            active={totalUsers === defaults.totalUsers}
            onClick={() => {
              setTotalUsers(defaults.totalUsers);
              setProPercent(defaults.proPercent);
            }}
          />
        </div>

        <div className="admin-cost-sliders">
          <SliderField
            label="Total users"
            value={totalUsers}
            min={10}
            max={5000}
            step={10}
            onChange={setTotalUsers}
          />
          <SliderField
            label="Pro subscribers"
            hint="Share of users on paid plan"
            value={proPercent}
            min={0}
            max={50}
            step={1}
            onChange={setProPercent}
            format={(v) => `${v}% (${Math.round(totalUsers * (v / 100))} users)`}
          />
          <SliderField
            label="Heavy Pro share"
            hint="Pro users on daily power-use (rest = moderate ~10 searches/mo)"
            value={proHeavyPercent}
            min={0}
            max={100}
            step={5}
            onChange={setProHeavyPercent}
            format={(v) => `${v}%`}
          />
          <SliderField
            label="Heavy Pro searches / day"
            hint="Daily job searches for heavy Pro users (cap 50)"
            value={proSearchesPerDay}
            min={1}
            max={20}
            step={1}
            onChange={setProSearchesPerDay}
          />
          <SliderField
            label="Free users active"
            hint="Share of free users maxing monthly limits (1 upload, 1 search, 1 doc)"
            value={freeActivePercent}
            min={10}
            max={100}
            step={5}
            onChange={setFreeActivePercent}
            format={(v) => `${v}%`}
          />
        </div>
      </div>

      <div className="admin-cost-card">
        <h3 className="admin-cost-title">Projected monthly cost</h3>
        <div className="admin-cost-summary">
          <div className="admin-cost-summary__hero">
            <span className="admin-cost-summary__label">Total infra</span>
            <span className="admin-cost-summary__amount">
              {projection.totalCostUsd == null ? "Over quota" : `$${projection.totalCostUsd.toFixed(2)}`}
            </span>
          </div>
          <div className="admin-cost-summary__net" style={{ color: (projection.netUsd ?? 0) >= 0 ? C.success : C.red }}>
            Net {projection.netUsd == null ? "—" : `$${projection.netUsd.toFixed(2)}`}
            {projection.revenueUsd > 0 && projection.netUsd != null && (
              <span style={{ color: C.muted, fontWeight: 500 }}> · {projection.marginPercent.toFixed(0)}% margin</span>
            )}
          </div>
        </div>

        <CostRow label="Anthropic AI" value={`$${projection.aiUsd.toFixed(2)}`} sub="Haiku 4.5 estimates" />
        <CostRow
          label="JSearch (RapidAPI)"
          value={
            projection.jsearchOverQuota
              ? "Over Basic quota"
              : projection.jsearchUsd == null
                ? "—"
                : `$${projection.jsearchUsd.toFixed(2)}`
          }
          sub={`~${projection.totalJsearchRequests.toLocaleString()} requests · ${projection.jsearchPlan?.label || "—"}${
            projection.jsearchOverage > 0 ? ` (+${projection.jsearchOverage} overage)` : ""
          }`}
        />
        <CostRow label="Firebase (est.)" value={`$${projection.firebaseUsd.toFixed(2)}`} sub="Not tracked — add your bill from Firebase console if needed" />
        <CostRow
          label="Pro revenue (net)"
          value={`$${projection.revenueUsd.toFixed(2)}`}
          accent={C.success}
          sub={`${Math.round(projection.proUsers)} Pro × $9.65 after Razorpay`}
        />

        <div className="admin-cost-divider" />

        <h4 className="admin-cost-subtitle">AI breakdown</h4>
        <CostRow label="Free tier" value={`$${projection.aiDetail.free.toFixed(2)}`} />
        <CostRow label="Pro moderate" value={`$${projection.aiDetail.proModerate.toFixed(2)}`} />
        <CostRow label="Pro heavy" value={`$${projection.aiDetail.proHeavy.toFixed(2)}`} />

        <div className="admin-cost-divider" />

        <h4 className="admin-cost-subtitle">JSearch plan tiers</h4>
        <div className="admin-cost-plans">
          {JSEARCH_PLANS.map((p) => (
            <div
              key={p.id}
              className={`admin-cost-plan${projection.jsearchPlan?.id === p.id ? " admin-cost-plan--active" : ""}`}
            >
              <strong>{p.label}</strong>
              <span>
                ${p.monthlyUsd}/mo · {p.included.toLocaleString()} req
              </span>
            </div>
          ))}
        </div>
      </div>

      {(jsearch.totalRequests > 0 || ai.estimatedUsd > 0) && (
        <div className="admin-cost-card admin-cost-actual">
          <h3 className="admin-cost-title">Actual vs projected (this month)</h3>
          <p className="admin-section-note" style={{ marginTop: 0 }}>
            Logged since JSearch + AI tracking was deployed. Older usage is not included.
          </p>
          <div className="admin-kpi-grid admin-kpi-grid--2" style={{ marginBottom: 16 }}>
            <div className="admin-kpi-card admin-cost-stat" style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Logged AI</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: C.text }}>${(ai.estimatedUsd || 0).toFixed(2)}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{ai.totalCalls || 0} calls</div>
            </div>
            <div className="admin-kpi-card admin-cost-stat" style={cardStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Logged JSearch</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: C.text }}>
                {(jsearch.totalRequests || 0).toLocaleString()} req
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                ~{jsearch.searchesEstimated || 0} searches · {jsearch.estimatedPlan || "—"}
                {jsearch.estimatedUsd != null ? ` · $${jsearch.estimatedUsd.toFixed(2)}` : jsearch.overQuota ? " · over Basic" : ""}
              </div>
            </div>
          </div>
          <CostRow
            label="Actual infra (logged + Firebase est.)"
            value={`$${actualTotal.toFixed(2)}`}
            sub={`Projected for ${totalUsers} users: $${projection.totalCostUsd?.toFixed(2) ?? "—"}`}
          />
        </div>
      )}
    </div>
  );
}

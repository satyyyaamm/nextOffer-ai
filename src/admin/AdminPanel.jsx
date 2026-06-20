import { useCallback, useEffect, useState } from "react";
import { C, cardStyle } from "../theme";
import { MobileNavToggle, MobileOnly, PageTitle, outlineBtnStyle, primaryBtnStyle } from "../ui";
import { getAdminDashboard, listAdminUsers, adminLogout } from "./adminApi";
import { getAdminSection, navigateAdminSection } from "./adminSession";
import { AdminShell } from "./AdminShell";
import {
  ActivityMetricsChart,
  AiByFeatureChart,
  AiSpendTrendChart,
  CheckoutFunnelChart,
  FreeUsageChart,
  SignupsSparkline,
  UserTierDonutChart,
} from "./AdminCharts";

const Spinner = ({ size = 20 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `2px solid ${C.border}`,
      borderTopColor: C.accent,
      animation: "spin .8s linear infinite",
    }}
  />
);

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="admin-kpi-card" style={{ ...cardStyle, padding: 16 }}>
      <div className="page-title" style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>
          {label}
        </p>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || C.text, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.sub, marginTop: 6, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

function checkoutBadge(status) {
  if (status === "completed") return { text: "Subscribed", color: C.success };
  if (status === "dismissed") return { text: "Abandoned", color: C.amber };
  if (status === "failed") return { text: "Failed", color: C.red };
  if (status === "started") return { text: "Started", color: C.accent };
  return { text: "—", color: C.muted };
}

function OverviewSection({ dashboard }) {
  const u = dashboard?.users || {};
  const funnel = dashboard?.checkoutFunnel || {};
  const ai = dashboard?.ai || {};
  const free = dashboard?.freeTierUsage || {};

  return (
    <>
      <div className="admin-kpi-grid">
        <KpiCard label="Total users" value={u.totalUsers ?? 0} sub={`${u.newUsers7d ?? 0} new · 7d`} />
        <KpiCard label="Pro subscribers" value={u.proUsers ?? 0} sub={`${u.proWeekly ?? 0} weekly · ${u.proMonthly ?? 0} monthly`} accent={C.success} />
        <KpiCard label="Free users" value={u.freeUsers ?? 0} sub={`${u.withResume ?? 0} with resume`} />
        <KpiCard label="AI spend (30d)" value={`$${(ai.last30DaysUsd ?? 0).toFixed(2)}`} sub={`${ai.currentMonth?.totalCalls ?? 0} calls this month`} accent={C.accent} />
      </div>

      <div className="admin-charts-grid admin-charts-grid--2">
        <UserTierDonutChart proUsers={u.proUsers ?? 0} freeUsers={u.freeUsers ?? 0} />
        <AiSpendTrendChart series={ai.dailySeries || []} />
      </div>

      <div className="admin-charts-grid admin-charts-grid--2" style={{ marginTop: 16 }}>
        <CheckoutFunnelChart funnel={funnel} />
        <FreeUsageChart free={free} />
      </div>

      <div style={{ marginTop: 16 }}>
        <SignupsSparkline series={ai.dailySeries || []} />
      </div>
    </>
  );
}

function CheckoutSection({ dashboard }) {
  const funnel = dashboard?.checkoutFunnel || {};
  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid--4">
        <KpiCard label="Checkout started" value={funnel.started ?? 0} sub="Opened Razorpay modal" />
        <KpiCard label="Subscribed" value={funnel.completed ?? 0} sub={`${funnel.conversionRate ?? 0}% conversion`} accent={C.success} />
        <KpiCard label="Abandoned" value={funnel.abandoned ?? 0} sub="Closed without paying" accent={C.amber} />
        <KpiCard label="Not converted" value={funnel.startedNotConverted ?? 0} sub={`${funnel.failed ?? 0} failed`} accent={C.red} />
      </div>
      <div style={{ marginTop: 16 }}>
        <CheckoutFunnelChart funnel={funnel} />
      </div>
    </>
  );
}

function AiSpendSection({ dashboard }) {
  const ai = dashboard?.ai || {};
  return (
    <>
      <p className="admin-section-note">{ai.pricingNote}</p>
      <div className="admin-charts-grid admin-charts-grid--1">
        <AiSpendTrendChart series={ai.dailySeries || []} />
      </div>
      <div className="admin-charts-grid admin-charts-grid--1" style={{ marginTop: 16 }}>
        <AiByFeatureChart byAction={ai.currentMonth?.byAction || {}} />
      </div>
    </>
  );
}

function ActivitySection({ dashboard }) {
  const activity = dashboard?.activity || {};
  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid--4">
        <KpiCard label="Documents generated" value={activity.totalDocumentsGenerated ?? "—"} />
        <KpiCard label="Job kits saved" value={activity.totalJobKitsSaved ?? "—"} />
        <KpiCard label="LinkedIn analyses" value={activity.totalLinkedInAnalyses ?? "—"} />
        <KpiCard label="Search runs" value={activity.totalSearchRuns ?? "—"} />
      </div>
      <div style={{ marginTop: 16 }}>
        <ActivityMetricsChart activity={activity} />
      </div>
      <p className="admin-section-note" style={{ marginTop: 12 }}>
        Client errors (7d): {activity.clientErrorsLast7d ?? "—"}
      </p>
    </>
  );
}

function ErrorsSection({ dashboard }) {
  const errors = dashboard?.recentErrors || [];
  if (!errors.length) {
    return <p style={{ color: C.sub, fontSize: 14 }}>No recent client errors.</p>;
  }
  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Screen</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e) => (
            <tr key={e.id}>
              <td>{e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}</td>
              <td>{e.screen || "—"}</td>
              <td>{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersSection({ users, hasMoreUsers, usersLoading, onLoadMore }) {
  return (
    <>
      <div style={{ ...cardStyle, overflow: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Tier</th>
              <th>Resume</th>
              <th>Usage (mo)</th>
              <th>Checkout</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const badge = checkoutBadge(row.checkoutStatus);
              return (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: C.text }}>{row.email || row.id.slice(0, 8)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{row.name}</div>
                  </td>
                  <td>{row.tier === "pro" ? `Pro (${row.proPlan || "?"})` : "Free"}</td>
                  <td>{row.hasResume ? "Yes" : "No"}</td>
                  <td style={{ fontSize: 12, lineHeight: 1.5 }}>
                    S:{row.searchesThisMonth} U:{row.uploadsThisMonth}
                    {row.kitUsedThisMonth ? " · Kit" : ""}
                    {row.linkedinThisMonth ? " · LI" : ""}
                  </td>
                  <td>
                    <span style={{ color: badge.color, fontWeight: 600, fontSize: 12 }}>{badge.text}</span>
                    {row.checkoutAttempts > 0 && (
                      <div style={{ fontSize: 11, color: C.muted }}>{row.checkoutAttempts} attempt(s)</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: C.sub }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMoreUsers && (
        <button type="button" onClick={onLoadMore} disabled={usersLoading} style={{ ...primaryBtnStyle(usersLoading), marginTop: 12 }}>
          {usersLoading ? "Loading…" : "Load more users"}
        </button>
      )}
    </>
  );
}

const SECTION_TITLES = {
  overview: { title: "Overview", subtitle: "High-level KPIs and user breakdown." },
  users: { title: "Users", subtitle: "All sign-ups with tier, usage, and checkout status." },
  checkout: { title: "Checkout funnel", subtitle: "Razorpay conversion and drop-off." },
  "ai-spend": { title: "AI spend", subtitle: "Token usage and estimated cost (Haiku 4.5)." },
  activity: { title: "Product activity", subtitle: "Documents, kits, searches, and errors." },
  errors: { title: "Client errors", subtitle: "Recent frontend errors from users." },
};

export function AdminPanel({ onLogout }) {
  const [section, setSection] = useState(getAdminSection);
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextPageId, setNextPageId] = useState(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminDashboard();
      setDashboard(result.data?.dashboard || null);
      const usersResult = await listAdminUsers({ limit: 40 });
      setUsers(usersResult.data?.users || []);
      setNextPageId(usersResult.data?.nextPageId || null);
      setHasMoreUsers(Boolean(usersResult.data?.hasMore));
    } catch (err) {
      const msg = err?.details || err?.message || "Could not load admin dashboard.";
      if (/expired|sign in again|permission-denied|permission denied/i.test(msg)) {
        await adminLogout();
        onLogout();
        return;
      }
      setError(msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onPop = () => setSection(getAdminSection());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const selectSection = (id) => {
    setSection(id);
    navigateAdminSection(id);
  };

  const loadMoreUsers = async () => {
    if (!nextPageId || usersLoading) return;
    setUsersLoading(true);
    try {
      const result = await listAdminUsers({ limit: 40, startAfterId: nextPageId });
      setUsers((prev) => [...prev, ...(result.data?.users || [])]);
      setNextPageId(result.data?.nextPageId || null);
      setHasMoreUsers(Boolean(result.data?.hasMore));
    } catch (err) {
      setError(err?.details || err?.message || "Could not load more users.");
    }
    setUsersLoading(false);
  };

  const handleLogout = async () => {
    await adminLogout();
    onLogout();
  };

  const meta = SECTION_TITLES[section] || SECTION_TITLES.overview;

  const renderSection = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub, padding: 32 }}>
          <Spinner size={24} /> Loading…
        </div>
      );
    }
    if (error && !dashboard) {
      return <div style={{ ...cardStyle, padding: 20, color: C.red, maxWidth: 480 }}>{error}</div>;
    }
    switch (section) {
      case "users":
        return <UsersSection users={users} hasMoreUsers={hasMoreUsers} usersLoading={usersLoading} onLoadMore={loadMoreUsers} />;
      case "checkout":
        return <CheckoutSection dashboard={dashboard} />;
      case "ai-spend":
        return <AiSpendSection dashboard={dashboard} />;
      case "activity":
        return <ActivitySection dashboard={dashboard} />;
      case "errors":
        return <ErrorsSection dashboard={dashboard} />;
      default:
        return <OverviewSection dashboard={dashboard} />;
    }
  };

  return (
    <AdminShell section={section} onNavigate={selectSection} onLogout={handleLogout}>
      <div className="screen-view" style={{ display: "flex", flexDirection: "column", minHeight: "100svh", width: "100%" }}>
        <header className="kit-screen-header">
          <MobileOnly>
            <div className="mobile-screen-header">
              <div className="mobile-screen-header__row">
                <div className="mobile-screen-header__main">
                  <div className="mobile-screen-header__menu">
                    <MobileNavToggle />
                  </div>
                  <div className="mobile-screen-header__text">
                    <h1 className="mobile-screen-header__title">{meta.title}</h1>
                    <p className="mobile-screen-header__subtitle">{meta.subtitle}</p>
                  </div>
                </div>
                <button type="button" onClick={loadDashboard} className="admin-header-refresh" style={outlineBtnStyle} disabled={loading}>
                  Refresh
                </button>
              </div>
            </div>
          </MobileOnly>
          <div className="admin-screen-header__toolbar">
            <PageTitle title={meta.title} subtitle={meta.subtitle} />
            <button type="button" onClick={loadDashboard} className="admin-header-refresh" style={outlineBtnStyle} disabled={loading}>
              Refresh
            </button>
          </div>
          {dashboard?.generatedAt && (
            <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>
              Updated {new Date(dashboard.generatedAt).toLocaleString()}
            </p>
          )}
        </header>

        <div className="kit-screen-content">
          <div className="kit-screen-body">{renderSection()}</div>
        </div>
      </div>
    </AdminShell>
  );
}

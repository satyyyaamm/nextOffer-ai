import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, cardStyle } from "../theme";

const CHART_COLORS = [C.accent, C.success, C.amber, C.red, "#6366F1", "#8B5CF6", "#EC4899"];

const tooltipStyle = {
  contentStyle: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: C.shadowMd,
    fontSize: 12,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  labelStyle: { color: C.text, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: C.sub, paddingTop: 2 },
};

function ChartCard({ title, subtitle, children, height = 280 }) {
  const sizeClass =
    height >= 320 ? "admin-chart-card__body--xl" : height >= 300 ? "admin-chart-card__body--lg" : height >= 220 ? "admin-chart-card__body--md" : "admin-chart-card__body--sm";
  return (
    <div className="admin-chart-card" style={cardStyle}>
      <div className="admin-chart-card__head">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className={`admin-chart-card__body ${sizeClass}`}>{children}</div>
    </div>
  );
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  return `${month}/${day}`;
}

export function AiSpendTrendChart({ series = [] }) {
  const data = series.map((d) => ({
    date: formatShortDate(d.date),
    spend: Number(d.estimatedUsd || 0),
    calls: d.calls || 0,
  }));

  if (!data.length) {
    return <p className="admin-chart-empty">No AI usage logged yet.</p>;
  }

  return (
    <ChartCard title="AI spend trend" subtitle="Daily estimated cost (USD) — last 30 days" height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="adminSpendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fill: C.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            width={48}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name) => [
              name === "spend" ? `$${Number(value).toFixed(4)}` : value,
              name === "spend" ? "Spend" : "Calls",
            ]}
          />
          <Area type="monotone" dataKey="spend" stroke={C.accent} strokeWidth={2.5} fill="url(#adminSpendGrad)" dot={false} activeDot={{ r: 4, fill: C.accent }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function UserTierDonutChart({ proUsers = 0, freeUsers = 0 }) {
  const data = [
    { name: "Pro", value: proUsers, color: C.success },
    { name: "Free", value: freeUsers, color: C.accent },
  ].filter((d) => d.value > 0);

  if (!data.length) {
    return <p className="admin-chart-empty">No users yet.</p>;
  }

  const total = proUsers + freeUsers;

  return (
    <ChartCard title="User mix" subtitle={`${total} total · Pro vs Free`} height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(value, name) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            formatter={(value) => <span style={{ color: C.sub, fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CheckoutFunnelChart({ funnel = {} }) {
  const data = [
    { stage: "Started", count: funnel.started ?? 0, fill: C.accent },
    { stage: "Subscribed", count: funnel.completed ?? 0, fill: C.success },
    { stage: "Abandoned", count: funnel.abandoned ?? 0, fill: C.amber },
    { stage: "Failed", count: funnel.failed ?? 0, fill: C.red },
  ];

  return (
    <ChartCard title="Checkout funnel" subtitle={`${funnel.conversionRate ?? 0}% conversion rate`} height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="stage" tick={{ fill: C.sub, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={88} />
          <Tooltip {...tooltipStyle} formatter={(value) => [value, "Users"]} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function FreeUsageChart({ free = {} }) {
  const data = [
    { feature: "Search", count: free.usedSearch ?? 0 },
    { feature: "Upload", count: free.usedUpload ?? 0 },
    { feature: "Kit gen", count: free.usedKit ?? 0 },
    { feature: "LinkedIn", count: free.usedLinkedIn ?? 0 },
  ];

  return (
    <ChartCard title="Free tier usage" subtitle="Users who hit limits this month" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="feature" tick={{ fill: C.sub, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
          <Tooltip {...tooltipStyle} formatter={(value) => [value, "Users"]} />
          <Bar dataKey="count" fill={C.accent} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ActivityMetricsChart({ activity = {} }) {
  const data = [
    { metric: "Documents", value: activity.totalDocumentsGenerated ?? 0 },
    { metric: "Job kits", value: activity.totalJobKitsSaved ?? 0 },
    { metric: "LinkedIn", value: activity.totalLinkedInAnalyses ?? 0 },
    { metric: "Searches", value: activity.totalSearchRuns ?? 0 },
  ].map((d, i) => ({ ...d, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <ChartCard title="Product activity" subtitle="All-time totals" height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="metric" tick={{ fill: C.sub, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
          <Tooltip {...tooltipStyle} formatter={(value) => [value ?? "—", "Count"]} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
            {data.map((entry) => (
              <Cell key={entry.metric} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AiByFeatureChart({ byAction = {} }) {
  const entries = Object.entries(byAction);
  if (!entries.length) {
    return <p className="admin-chart-empty">No feature breakdown this month.</p>;
  }

  const data = entries.map(([name, stats], i) => ({
    name: name.replace(/^generateDocument:/, "doc:"),
    spend: Number(stats.estimatedUsd || 0),
    calls: stats.calls || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <ChartCard title="AI cost by feature" subtitle="Current month · estimated USD" height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: C.sub, fontSize: 10, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-28}
            textAnchor="end"
            height={56}
          />
          <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name, props) => {
              if (name === "spend") return [`$${Number(value).toFixed(4)}`, "Spend"];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              const calls = payload?.[0]?.payload?.calls;
              return calls != null ? `${label} · ${calls} calls` : label;
            }}
          />
          <Bar dataKey="spend" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SignupsSparkline({ series = [] }) {
  const data = series.slice(-14).map((d) => ({
    date: formatShortDate(d.date),
    calls: d.calls || 0,
  }));

  if (!data.length) return null;

  return (
    <ChartCard title="AI activity (14d)" subtitle="Daily API calls" height={220}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="adminCallsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.success} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.success} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip {...tooltipStyle} formatter={(value) => [value, "Calls"]} />
          <Area type="monotone" dataKey="calls" stroke={C.success} strokeWidth={2} fill="url(#adminCallsGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function JSearchUsageChart({ series = [] }) {
  const data = series.map((d) => ({
    date: formatShortDate(d.date),
    requests: d.requests || 0,
  }));

  if (!data.some((d) => d.requests > 0)) {
    return <p className="admin-chart-empty">No JSearch requests logged yet. Deploy functions to start tracking.</p>;
  }

  return (
    <ChartCard title="JSearch API usage" subtitle="RapidAPI credits consumed — last 30 days (1 HTTP call = 1 credit)" height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="adminJsearchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.amber} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.amber} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.borderLight} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...tooltipStyle} formatter={(value) => [value, "Requests"]} />
          <Area type="monotone" dataKey="requests" stroke={C.amber} strokeWidth={2} fill="url(#adminJsearchGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

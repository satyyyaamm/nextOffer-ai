/** Light professional design tokens — teal / green (trust + clarity) */
export const C = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  sub: "#64748B",
  muted: "#94A3B8",
  accent: "#0F766E",
  accentHover: "#0D9488",
  accentLight: "#0D9488",
  accentSoft: "#CCFBF1",
  accentGlow: "rgba(15, 118, 110, 0.12)",
  brandHighlight: "#0F766E",
  success: "#059669",
  green: "#059669",
  greenGlow: "rgba(5, 150, 105, 0.1)",
  warning: "#D97706",
  amber: "#D97706",
  danger: "#DC2626",
  red: "#DC2626",
  shadowSm: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
  shadowMd: "0 4px 16px rgba(15, 23, 42, 0.08)",
  shadowLg: "0 12px 40px rgba(15, 23, 42, 0.12)",
  loginGradient: "linear-gradient(180deg, #F8FAFC 0%, #F0FDFA 100%)",
};

export const font = "'Inter', 'Segoe UI', system-ui, sans-serif";

export const layout = {
  mobileMax: 480,
  sidebarWidth: 240,
  contentMax: 960,
  formMax: 640,
  breakpointMd: 768,
  breakpointLg: 1024,
  maxWidth: 960,
  contentWidth: 960,
  narrowWidth: 640,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const REGIONS = [
  { label: "United States", flag: "🇺🇸", currency: "USD", symbol: "$" },
  { label: "India", flag: "🇮🇳", currency: "INR", symbol: "₹" },
  { label: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£" },
  { label: "Canada", flag: "🇨🇦", currency: "CAD", symbol: "C$" },
  { label: "Australia", flag: "🇦🇺", currency: "AUD", symbol: "A$" },
  { label: "Germany", flag: "🇩🇪", currency: "EUR", symbol: "€" },
];

/** Popular cities shown after a country is selected on the filters screen. */
export const TOP_CITIES_BY_REGION = {
  "United States": [
    "New York",
    "San Francisco",
    "Los Angeles",
    "Chicago",
    "Seattle",
    "Austin",
    "Boston",
    "Denver",
  ],
  India: ["Bengaluru", "Mumbai", "Hyderabad", "Delhi", "Pune", "Chennai", "Kolkata", "Gurgaon"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds", "Glasgow"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"],
  Germany: ["Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne", "Stuttgart"],
};

export const btnPrimary = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  background: C.accent,
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "none",
  cursor: "pointer",
  transition: "background 0.15s ease, transform 0.1s ease",
};

export const cardStyle = {
  background: C.surface,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  boxShadow: C.shadowSm,
};

/** Pro subscription display prices (USD). Checkout via Razorpay — works for users worldwide with supported cards. */
export const PRO_PRICING = {
  currency: "USD",
  symbol: "$",
  weekly: { amount: 5.99, period: "/week", cta: "Continue — $5.99/week" },
  monthly: { amount: 9.99, period: "/month", cta: "Continue — $9.99/month" },
};

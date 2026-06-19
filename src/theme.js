/** Premium light design tokens — teal / green (trust + clarity) */
export const C = {
  bg: "#F4F7FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  borderLight: "#EEF2F6",
  text: "#0B1220",
  sub: "#5B6478",
  muted: "#94A3B8",
  accent: "#0F766E",
  accentHover: "#0D9488",
  accentLight: "#14B8A6",
  accentSoft: "#E6FAF7",
  accentGlow: "rgba(15, 118, 110, 0.14)",
  accentGradient: "linear-gradient(135deg, #0F766E 0%, #0D9488 55%, #14B8A6 100%)",
  brandHighlight: "#0F766E",
  success: "#059669",
  green: "#059669",
  greenGlow: "rgba(5, 150, 105, 0.12)",
  warning: "#D97706",
  amber: "#D97706",
  danger: "#DC2626",
  red: "#DC2626",
  shadowSm: "0 1px 2px rgba(11, 18, 32, 0.04), 0 4px 12px rgba(11, 18, 32, 0.05)",
  shadowMd: "0 4px 6px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.08)",
  shadowLg: "0 8px 16px rgba(11, 18, 32, 0.06), 0 24px 48px rgba(11, 18, 32, 0.1)",
  shadowAccent: "0 4px 14px rgba(15, 118, 110, 0.28)",
  loginGradient: "linear-gradient(165deg, #F8FAFC 0%, #F0FDFA 45%, #ECFDF5 100%)",
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 18,
  radiusXl: 22,
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
  padding: "14px 18px",
  borderRadius: C.radiusMd,
  background: C.accentGradient,
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "none",
  cursor: "pointer",
  boxShadow: C.shadowAccent,
  transition: "transform 0.15s ease, box-shadow 0.2s ease, filter 0.15s ease",
};

export const cardStyle = {
  background: C.surface,
  borderRadius: C.radiusLg,
  border: `1px solid ${C.borderLight}`,
  boxShadow: C.shadowSm,
};

/** Pro subscription display prices (USD). Checkout via Razorpay — works for users worldwide with supported cards. */
export const PRO_PRICING = {
  currency: "USD",
  symbol: "$",
  weekly: { amount: 5.99, period: "/week", cta: "Continue — $5.99/week" },
  monthly: { amount: 9.99, period: "/month", cta: "Continue — $9.99/month" },
};

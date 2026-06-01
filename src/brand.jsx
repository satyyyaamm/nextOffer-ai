import { C } from "./theme";

export const APP_NAME = "NextOffer.ai";

export const AppLogo = ({ size = 72, className = "", style = {} }) => (
  <img
    src={`${process.env.PUBLIC_URL || ""}/logo.png`}
    alt={APP_NAME}
    width={size}
    height={size}
    className={className || undefined}
    style={{
      borderRadius: Math.round(size * 0.22),
      display: "block",
      objectFit: "cover",
      boxShadow: C.shadowMd,
      ...style,
    }}
  />
);

export const AppBrand = ({ fontSize = 28 }) => (
  <h1 style={{ fontSize, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6, color: C.text, textAlign: "inherit" }}>
    NextOffer<span style={{ color: C.brandHighlight }}>.ai</span>
  </h1>
);

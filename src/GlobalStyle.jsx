import { C, font } from "./theme";

export function GlobalStyle() {
  return (
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
}

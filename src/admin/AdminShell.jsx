import { useCallback, useEffect, useMemo, useState } from "react";
import { C } from "../theme";
import { AppLogo } from "../brand";
import { IconBarChart, IconBuilding, IconCreditCard, IconSearch, IconUpload, IconX } from "../icons";
import { MobileNavContext } from "../ui";

const ADMIN_NAV = [
  { id: "overview", label: "Overview", icon: IconBarChart },
  { id: "users", label: "Users", icon: IconBuilding },
  { id: "checkout", label: "Checkout", icon: IconCreditCard },
  { id: "ai-spend", label: "AI spend", icon: IconUpload },
  { id: "activity", label: "Activity", icon: IconSearch },
  { id: "errors", label: "Errors", icon: IconX },
];

function AdminSidebar({ section, onNavigate, onLogout, variant = "desktop", onClose }) {
  const isDrawer = variant === "mobile";

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
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Admin dashboard</div>
        </div>
      )}

      <nav className="app-sidebar__nav" aria-label="Admin navigation">
        {ADMIN_NAV.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              className={`sidebar-nav-item${active ? " sidebar-nav-item--active" : ""}`}
              onClick={() => {
                onNavigate(id);
                onClose?.();
              }}
            >
              <Icon size={18} color={active ? C.accent : C.sub} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="app-sidebar__footer">
        <a href="/" className="sidebar-privacy-link" style={{ display: "block", marginBottom: 10 }}>
          ← Back to app
        </a>
        <button
          type="button"
          onClick={() => {
            onLogout();
            onClose?.();
          }}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            background: C.bg,
            color: C.sub,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${C.border}`,
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function AdminShell({ section, onNavigate, onLogout, children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openNav = useCallback(() => setMobileNavOpen(true), []);
  const closeNav = useCallback(() => setMobileNavOpen(false), []);
  const mobileNav = useMemo(() => ({ openNav, closeNav }), [openNav, closeNav]);

  useEffect(() => {
    closeNav();
  }, [section, closeNav]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const sidebarProps = { section, onNavigate, onLogout };

  return (
    <MobileNavContext.Provider value={mobileNav}>
      <div className="app-shell app-root">
        <AdminSidebar {...sidebarProps} variant="desktop" />
        {mobileNavOpen && (
          <button type="button" className="app-mobile-nav-backdrop mobile-only" aria-label="Close navigation menu" onClick={closeNav} />
        )}
        <div className={`app-mobile-nav mobile-only${mobileNavOpen ? " app-mobile-nav--open" : ""}`} aria-hidden={!mobileNavOpen}>
          <AdminSidebar {...sidebarProps} variant="mobile" onClose={closeNav} />
        </div>
        <div className="app-main">{children}</div>
      </div>
    </MobileNavContext.Provider>
  );
}

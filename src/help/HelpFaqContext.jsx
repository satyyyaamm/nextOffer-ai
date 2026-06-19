import { createContext, useCallback, useContext, useMemo, useState } from "react";

const HelpFaqContext = createContext(null);

export function HelpFaqProvider({ children, baseContext = {} }) {
  const [open, setOpen] = useState(false);
  const [extraContext, setExtraContext] = useState({});

  const context = useMemo(
    () => ({ ...baseContext, ...extraContext }),
    [baseContext, extraContext],
  );

  const openHelp = useCallback(() => {
    if (extraContext.upgradeModalOpen) return;
    setOpen(true);
  }, [extraContext.upgradeModalOpen]);

  const closeHelp = useCallback(() => setOpen(false), []);

  const setContext = useCallback((partial) => {
    setExtraContext((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      open: openHelp,
      close: closeHelp,
      isOpen: open,
      context,
      setContext,
    }),
    [openHelp, closeHelp, open, context, setContext],
  );

  return <HelpFaqContext.Provider value={value}>{children}</HelpFaqContext.Provider>;
}

export function useHelpFaq() {
  const ctx = useContext(HelpFaqContext);
  if (!ctx) {
    throw new Error("useHelpFaq must be used within HelpFaqProvider");
  }
  return ctx;
}

/** Safe hook for optional usage outside provider (returns no-op). */
export function useHelpFaqOptional() {
  return useContext(HelpFaqContext);
}

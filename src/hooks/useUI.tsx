"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface UIContextValue {
  quickCreateOpen: boolean;
  openQuickCreate: () => void;
  closeQuickCreate: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const value = useMemo<UIContextValue>(
    () => ({
      quickCreateOpen,
      openQuickCreate: () => setQuickCreateOpen(true),
      closeQuickCreate: () => setQuickCreateOpen(false),
      searchOpen,
      setSearchOpen,
    }),
    [quickCreateOpen, searchOpen],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI deve ser usado dentro de UIProvider");
  return ctx;
}

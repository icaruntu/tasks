"use client";

import { createContext, useContext, useState } from "react";
import { DEFAULT_FILTERS, type ViewFilters } from "@/lib/types";

type UICtx = {
  openTaskId: string | null;
  openTask: (id: string | null) => void;
  filters: ViewFilters;
  setFilters: (f: ViewFilters | ((prev: ViewFilters) => ViewFilters)) => void;
  pomodoroTaskId: string | null;
  setPomodoroTaskId: (id: string | null) => void;
};

const Ctx = createContext<UICtx | null>(null);

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI must be used inside UIProvider");
  return c;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ViewFilters>(DEFAULT_FILTERS);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);

  return (
    <Ctx.Provider
      value={{
        openTaskId,
        openTask: setOpenTaskId,
        filters,
        setFilters,
        pomodoroTaskId,
        setPomodoroTaskId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

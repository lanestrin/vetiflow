import { createContext, useContext } from "react";

// The "Demo role — simulated access" switch (build plan 2.28): which view the
// app shows. It shapes the screen only; it is never authorization (S.6).
export type DemoRole = "veterinarian" | "technician";

export type DemoRoleState = [role: DemoRole, setRole: (role: DemoRole) => void];

export const DemoRoleContext = createContext<DemoRoleState | null>(null);

export function useDemoRole(): DemoRoleState {
  const state = useContext(DemoRoleContext);
  if (!state) {
    throw new Error("useDemoRole must be used inside a DemoRoleProvider.");
  }
  return state;
}

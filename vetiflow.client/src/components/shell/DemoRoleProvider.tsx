import { useMemo, useState, type ReactNode } from "react";
import { DemoRoleContext, type DemoRole, type DemoRoleState } from "./demoRoleContext";

// Remembered per browser as a convenience: only the role's name, never a
// security control. Storage that cannot be read or written leaves the default.
const storageKey = "vetiflow.demoRole";

function readStoredRole(): DemoRole {
  try {
    return localStorage.getItem(storageKey) === "technician" ? "technician" : "veterinarian";
  } catch {
    return "veterinarian";
  }
}

function storeRole(role: DemoRole) {
  try {
    localStorage.setItem(storageKey, role);
  } catch {
    // The role still applies for this page; it is just not remembered.
  }
}

// App-wide demo role (2.28), held by the shell so every page shows the same view.
export function DemoRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState(readStoredRole);
  const state = useMemo<DemoRoleState>(() => [role, (next) => {
    setRole(next);
    storeRole(next);
  }], [role]);

  return <DemoRoleContext value={state}>{children}</DemoRoleContext>;
}

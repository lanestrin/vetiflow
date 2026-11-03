import { useEffect, useState } from "react";
import type { DemoRole } from "../shell/demoRoleContext";
import { getTeam } from "../../services/staffApi";
import type { TeamClinician } from "../../types/Team";

// The fictional person each demo role acts as (2.28), as 2.24 seeds them:
// the first veterinarian and technician by last name, who hold the demo cases.
const demoPeople: Record<DemoRole, { displayName: string; label: string }> = {
  veterinarian: { displayName: "Dr. Jordan Lee", label: "J. Lee" },
  technician: { displayName: "Riley Chen", label: "R. Chen" }
};

export interface DemoIdentity {
  role: DemoRole;
  // "J. Lee", beside the switch.
  label: string;
  // The person's staff record; null while the team loads, after it fails or
  // when the person is not on the team.
  staffId: string | null;
  // Why My patients and Assign me are unavailable, or null when they are not.
  unavailableReason: string | null;
}

type TeamState = { kind: "loading" } | { kind: "shown"; list: TeamClinician[] } | { kind: "failed" };

// Finds the demo role's person on the team, loading the team once.
export function useDemoIdentity(role: DemoRole): DemoIdentity {
  const [team, setTeam] = useState<TeamState>({ kind: "loading" });

  useEffect(() => {
    let isActive = true;
    getTeam()
      .then((list) => { if (isActive) setTeam({ kind: "shown", list }); })
      .catch(() => { if (isActive) setTeam({ kind: "failed" }); });
    return () => { isActive = false; };
  }, []);

  const person = demoPeople[role];
  const staffId = team.kind === "shown"
    ? team.list.find((member) => member.role === role && member.displayName === person.displayName)?.id ?? null
    : null;
  const unavailableReason = team.kind === "loading"
    ? "Loading the demo team…"
    : staffId === null ? "The demo team could not be loaded." : null;

  return { role, label: person.label, staffId, unavailableReason };
}

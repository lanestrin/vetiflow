import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { createCaseHubConnection } from "../services/caseHub";
import { clearAccessToken } from "../services/session";
import { getTeam } from "../services/staffApi";
import { staffStatusLabel } from "../types/StaffStatus";
import type { TeamClinician } from "../types/Team";
import styles from "./TeamPage.module.scss";

// The Team page (build plan 4.5): who is on the floor and who is Unavailable, and
// what each clinician is working on. It reloads when a case changes, as the board
// does. Status changes show on the next load.
export function TeamPage() {
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamClinician[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reloadTeam = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isActive = true;

    const connection = createCaseHubConnection();

    async function loadTeam() {
      try {
        const clinicians = await getTeam();

        if (!isActive) {
          return;
        }

        setTeam(clinicians);
        setError(null);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        // The token expired or was refused while the page was open.
        if (loadError instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (loadError instanceof AccessDeniedError) {
          navigate("/pet-parent", { replace: true });
        } else {
          setError("Unable to load the team.");
        }
      }
    }

    connection.on("caseUpdated", () => {
      void loadTeam();
    });

    async function startLiveUpdates() {
      try {
        await connection.start();
      } catch (connectionError) {
        console.error("Unable to connect to live case updates.", connectionError);
      }
    }

    reloadTeam.current = loadTeam;
    void loadTeam();
    void startLiveUpdates();

    return () => {
      isActive = false;
      connection.off("caseUpdated");
      void connection.stop();
    };
  }, [navigate]);

  const onFloor = team?.filter((clinician) => clinician.status !== "unavailable") ?? [];
  const unavailable = team?.filter((clinician) => clinician.status === "unavailable") ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Team</h1>
        <p className={styles.subtitle}>Who is on the floor, and what each clinician is working on.</p>
      </header>

      {error && (
        <div className={styles.message} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.retry} onClick={() => void reloadTeam.current()}>
            Try again
          </button>
        </div>
      )}
      {!error && team === null && <p className={styles.message}>Loading the team…</p>}
      {team !== null && team.length === 0 && <p className={styles.message}>No clinicians recorded</p>}

      {team !== null && team.length > 0 && (
        <>
          <TeamGroup title="On the floor" clinicians={onFloor} emptyText="No one is on the floor" />
          <TeamGroup title="Unavailable" clinicians={unavailable} emptyText="No one is unavailable" />
        </>
      )}
    </main>
  );
}

function TeamGroup({ title, clinicians, emptyText }: { title: string; clinicians: TeamClinician[]; emptyText: string }) {
  const id = useId();

  return (
    <section className={styles.group} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.groupTitle}>
        {title} <span className={styles.count}>{clinicians.length}</span>
      </h2>
      {clinicians.length === 0
        ? <p className={styles.empty}>{emptyText}</p>
        : (
          <ul className={styles.list}>
            {clinicians.map((clinician) => <ClinicianRow key={clinician.id} clinician={clinician} />)}
          </ul>
        )}
    </section>
  );
}

function ClinicianRow({ clinician }: { clinician: TeamClinician }) {
  return (
    <li className={styles.clinician}>
      <div className={styles.person}>
        <span className={styles.initials} aria-hidden="true">{clinician.initials}</span>
        <div className={styles.identity}>
          <strong className={styles.name}>{clinician.displayName}</strong>
          <span className={styles.role}>{roleLabel(clinician.role)}</span>
        </div>
        <span className={styles.status}>{staffStatusLabel(clinician.status)}</span>
        <span className={styles.caseCount}>{caseCountLabel(clinician.activeCaseCount)}</span>
      </div>
      {clinician.activeCases.length === 0
        ? <p className={styles.empty}>No active cases</p>
        : (
          <ul className={styles.cases} aria-label={`Active cases for ${clinician.displayName}`}>
            {clinician.activeCases.map((activeCase) => (
              <li key={activeCase.id}>{activeCase.caseNumber} · {activeCase.patientName}</li>
            ))}
          </ul>
        )}
    </li>
  );
}

const roleLabels: Record<string, string> = {
  veterinarian: "Veterinarian",
  technician: "Technician"
};

function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}

function caseCountLabel(count: number): string {
  return count === 1 ? "1 active case" : `${count} active cases`;
}

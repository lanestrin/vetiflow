import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { getPatientVisitHistory } from "../services/recordsApi";
import { clearAccessToken } from "../services/session";
import type { PatientVisit, PatientVisitHistory } from "../types/PatientVisitHistory";
import styles from "./PatientProfilePage.module.scss";

// What the load found. `forKey` ties it to the patient and attempt that asked,
// so an old result never shows for another patient.
type LoadResult =
  | { forKey: string; kind: "found"; history: PatientVisitHistory }
  | { forKey: string; kind: "notFound" }
  | { forKey: string; kind: "failed" };

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${dayFormat.format(date)}, ${timeFormat.format(date)}`;
}

// A patient's profile with Visit History (build plan 4.21b): every ER visit,
// active and discharged, newest first. RequireExperience lets only team members
// in; the API's 401 and 403 are the real check. Overview and Documents come later.
export function PatientProfilePage() {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const loadKey = `${patientId}#${attempt}`;

  useEffect(() => {
    // Another patient, or leaving the page, cancels this load.
    const controller = new AbortController();

    getPatientVisitHistory(patientId, controller.signal)
      .then((history) => {
        setResult(history === null
          ? { forKey: loadKey, kind: "notFound" }
          : { forKey: loadKey, kind: "found", history });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (error instanceof AccessDeniedError) {
          navigate("/pet-parent", { replace: true });
        } else {
          setResult({ forKey: loadKey, kind: "failed" });
        }
      });

    return () => controller.abort();
  }, [patientId, loadKey, navigate]);

  const current = result !== null && result.forKey === loadKey ? result : null;

  return (
    <main className={styles.page}>
      <title>{current?.kind === "found" ? `${current.history.patient.name} · VetiFlow` : "Patient record · VetiFlow"}</title>
      <Link to="/records" className={styles.back}>
        <span aria-hidden="true">← </span>Patients
      </Link>

      {current === null && <p className={styles.message} role="status">Loading the patient record…</p>}
      {current?.kind === "notFound" && (
        <>
          <h1 className={styles.title}>Patient record</h1>
          <p className={styles.message}>This patient record could not be found.</p>
        </>
      )}
      {current?.kind === "failed" && (
        <>
          <h1 className={styles.title}>Patient record</h1>
          <div className={styles.message} role="alert">
            <p>Visit history isn't available right now. Try again in a moment.</p>
            <button type="button" className={styles.retry} onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        </>
      )}
      {current?.kind === "found" && <PatientProfile history={current.history} />}
    </main>
  );
}

function PatientProfile({ history }: { history: PatientVisitHistory }) {
  const id = useId();
  const { patient, visits } = history;

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h1 className={styles.title}>{patient.name}</h1>
        <p className={styles.detail}>{patient.breed ? `${patient.species} · ${patient.breed}` : patient.species}</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Patient record">
        <button type="button" role="tab" aria-selected="false" disabled title="Coming soon" className={styles.tab}>
          Overview
        </button>
        <button
          type="button"
          role="tab"
          id={`${id}-tab`}
          aria-selected="true"
          aria-controls={`${id}-panel`}
          className={styles.tabSelected}
        >
          Visit History
        </button>
        <button type="button" role="tab" aria-selected="false" disabled title="Coming soon" className={styles.tab}>
          Documents
        </button>
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab`} className={styles.panel}>
        <h2 className={styles.panelTitle}>Previous Encounters</h2>
        <p className={styles.hint}>Each visit lists what was recorded at the time.</p>
        {visits.length === 0
          ? <p className={styles.empty}>No visits recorded for this patient.</p>
          : (
            <ul className={styles.visits}>
              {visits.map((visit) => <VisitCard key={visit.caseId} visit={visit} />)}
            </ul>
          )}
      </div>
    </section>
  );
}

function VisitCard({ visit }: { visit: PatientVisit }) {
  return (
    <li className={styles.visit}>
      <div className={styles.visitTop}>
        <strong className={styles.visitDate}>{formatDateTime(visit.arrivalTime)}</strong>
        {visit.dischargedAt
          ? <span className={styles.discharged}>Discharged {formatDateTime(visit.dischargedAt)}</span>
          : <span className={styles.active}>Active</span>}
      </div>
      <p className={styles.complaint}>{visit.presentingComplaint}</p>
      <p className={styles.meta}>
        ER visit · {visit.caseNumber} · {visit.attendingDoctor ? visit.attendingDoctor.name : "No doctor recorded"}
      </p>
    </li>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { AcuityBadge } from "../components/clinical/AcuityBadge";
import { ClinicalReviewDrawer } from "../components/overview/ClinicalReviewDrawer";
import { dateTimeLabel } from "../components/overview/overviewFormat";
import { TimelineReviewDrawer } from "../components/overview/TimelineReviewDrawer";
import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { getCase } from "../services/casesApi";
import { clearAccessToken } from "../services/session";
import type { CaseDetail } from "../types/CaseDetail";
import styles from "./VisitRecordPage.module.scss";

// What the load found, tied to the visit and attempt that asked for it.
type LoadResult =
  | { forKey: string; kind: "found"; detail: CaseDetail }
  | { forKey: string; kind: "notFound" }
  | { forKey: string; kind: "failed" };

type ReviewKind = "clinical" | "timeline";

const reviewDrawers = { clinical: ClinicalReviewDrawer, timeline: TimelineReviewDrawer };

// One past or current ER visit, read-only (build plan 4.21d): its summary and
// its own Clinical and Timeline reviews. The case number and arrival date stay
// in view so history never reads as the current visit. RequireExperience lets
// only team members in; the API's 401 and 403 are the real check.
export function VisitRecordPage() {
  const { patientId = "", caseId = "" } = useParams();
  const navigate = useNavigate();
  // Passed back to the profile, so a trip from the board can still return there (4.21c).
  const routeState: unknown = useLocation().state;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const loadKey = `${patientId}/${caseId}#${attempt}`;

  useEffect(() => {
    let isActive = true;

    getCase(caseId)
      .then((detail) => {
        if (!isActive) return;
        // A case of another patient is not this patient's visit.
        setResult(detail === null || detail.patient.id !== patientId
          ? { forKey: loadKey, kind: "notFound" }
          : { forKey: loadKey, kind: "found", detail });
      })
      .catch((error: unknown) => {
        if (!isActive) return;

        if (error instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (error instanceof AccessDeniedError) {
          navigate("/pet-parent", { replace: true });
        } else {
          setResult({ forKey: loadKey, kind: "failed" });
        }
      });

    return () => {
      isActive = false;
    };
  }, [patientId, caseId, loadKey, navigate]);

  const current = result !== null && result.forKey === loadKey ? result : null;
  const detail = current?.kind === "found" ? current.detail : null;

  return (
    <main className={styles.page}>
      <title>{detail ? `${detail.caseNumber} · ${detail.patient.name} · VetiFlow` : "Visit record · VetiFlow"}</title>
      <Link to={`/records/${patientId}`} state={routeState} className={styles.back}>
        <span aria-hidden="true">← </span>{detail ? detail.patient.name : "Patient record"}
      </Link>

      {current === null && <p className={styles.message} role="status">Loading the visit record…</p>}
      {current?.kind === "notFound" && (
        <>
          <h1 className={styles.title}>Visit record</h1>
          <p className={styles.message}>This visit record could not be found.</p>
        </>
      )}
      {current?.kind === "failed" && (
        <>
          <h1 className={styles.title}>Visit record</h1>
          <div className={styles.message} role="alert">
            <p>This visit record isn't available right now. Try again in a moment.</p>
            <button type="button" className={styles.retry} onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        </>
      )}
      {detail && <VisitRecord key={detail.id} detail={detail} />}
    </main>
  );
}

function VisitRecord({ detail }: { detail: CaseDetail }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const clinicalRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<HTMLButtonElement>(null);
  const [review, setReview] = useState<ReviewKind | null>(null);
  const { patient } = detail;
  const species = patient.breed ? `${patient.species} · ${patient.breed}` : patient.species;
  const ReviewDrawer = reviewDrawers[review ?? "clinical"];
  const reviewTriggers = { clinical: clinicalRef, timeline: timelineRef };

  return (
    <section className={styles.card} aria-labelledby="visit-record-title">
      <header className={styles.head}>
        <h1 ref={headingRef} id="visit-record-title" tabIndex={-1} className={styles.title}>ER visit · {detail.caseNumber}</h1>
        <p className={styles.detail}>{patient.name} · {species} · Arrived {dateTimeLabel(detail.arrivalTime)}</p>
      </header>

      <section aria-labelledby="visit-summary-title">
        <h2 id="visit-summary-title" className={styles.sectionTitle}>Visit summary</h2>
        <dl className={styles.summary}>
          <div><dt>Reason</dt><dd>{detail.presentingComplaint.trim() || "Not recorded"}</dd></div>
          <div><dt>Acuity</dt><dd><AcuityBadge acuity={detail.acuity} isProvisional={detail.stage === "incoming"} /></dd></div>
          <div>
            <dt>Outcome</dt>
            <dd>{detail.dischargedAt ? `Discharged ${dateTimeLabel(detail.dischargedAt)}` : "Active – still on the ER board"}</dd>
          </div>
          <div><dt>Attending veterinarian</dt><dd>{detail.assignedDoctor?.name ?? "Unassigned"}</dd></div>
          <div><dt>Primary technician</dt><dd>{detail.assignedTechnician?.name ?? "Not assigned"}</dd></div>
          <div><dt>Arrived</dt><dd>{dateTimeLabel(detail.arrivalTime)}</dd></div>
          <div><dt>Discharged</dt><dd>{detail.dischargedAt ? dateTimeLabel(detail.dischargedAt) : "Not discharged"}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="visit-reviews-title">
        <h2 id="visit-reviews-title" className={styles.sectionTitle}>Records from this visit</h2>
        <div className={styles.reviewGrid}>
          <button ref={clinicalRef} type="button" className={styles.reviewButton} onClick={() => setReview("clinical")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" /></svg>
            Clinical
          </button>
          <button ref={timelineRef} type="button" className={styles.reviewButton} onClick={() => setReview("timeline")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 1 2 6M4 5v6h6M12 7v5l3 2" /></svg>
            Timeline
          </button>
        </div>
      </section>

      {review !== null && (
        <ReviewDrawer key={review} detail={detail} triggerRef={reviewTriggers[review]} fallbackRef={headingRef}
          onClose={() => setReview(null)} />
      )}
    </section>
  );
}

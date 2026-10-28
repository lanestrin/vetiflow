import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInRouteState } from "../auth/experienceHome";
import { AcuityBadge } from "../clinical/AcuityBadge";
import { useNow } from "../board/useNow";
import { AccessDeniedError, SessionEndedError } from "../../services/apiErrors";
import { getCase } from "../../services/casesApi";
import { clearAccessToken } from "../../services/session";
import type { CaseDetail } from "../../types/CaseDetail";
import {
  checkInLabel,
  eventDetail,
  eventLabel,
  locationLabel,
  longAgeLabel,
  speciesKind,
  taskMeta,
  temperatureLabel,
  timeLabel,
  weightLabel
} from "./overviewFormat";
import styles from "./PatientOverviewPanel.module.scss";

type LoadResult =
  | { kind: "shown"; detail: CaseDetail }
  | { kind: "notFound" }
  | { kind: "failed" };

interface PatientOverviewPanelProps {
  caseId: string | null;
  // When the board last loaded; a change loads the shown case again.
  refreshedAt: Date;
}

const avatars = { dog: "🐕", cat: "🐈", other: "🐾" };

const notRecorded = "Not recorded";

// The prototype's "Patient overview" (build plan 3.2b) for the card selected
// on the board. The buttons that later items wire are shown disabled.
export function PatientOverviewPanel({ caseId, refreshedAt }: PatientOverviewPanelProps) {
  const titleId = useId();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  // Keyed by case and attempt, so a board reload keeps the shown case on
  // screen while a new case or a retry shows "Loading case…".
  const [loaded, setLoaded] = useState<{ key: string; result: LoadResult } | null>(null);
  const key = `${caseId}:${attempt}`;

  useEffect(() => {
    if (caseId === null) {
      return;
    }

    let isActive = true;

    async function loadCase(id: string) {
      try {
        const detail = await getCase(id);
        if (isActive) {
          setLoaded({ key, result: detail ? { kind: "shown", detail } : { kind: "notFound" } });
        }
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        if (loadError instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (loadError instanceof AccessDeniedError) {
          navigate("/pet-parent", { replace: true });
        } else {
          setLoaded({ key, result: { kind: "failed" } });
        }
      }
    }

    void loadCase(caseId);

    return () => {
      isActive = false;
    };
  }, [caseId, key, refreshedAt, navigate]);

  const result = caseId !== null && loaded?.key === key ? loaded.result : null;
  const detail = result?.kind === "shown" ? result.detail : null;

  return (
    <aside className={styles.panel} aria-labelledby={titleId} aria-busy={caseId !== null && result === null}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>Patient overview</h2>
          {detail && <CaseLine detail={detail} />}
        </div>
        {detail && (
          <button type="button" className={styles.toolButton} aria-label="More actions" disabled>
            •••
          </button>
        )}
      </header>

      {caseId === null && (
        <p className={styles.message}>Select a patient on the board to see their overview.</p>
      )}
      {caseId !== null && result === null && <p className={styles.message}>Loading case…</p>}
      {result?.kind === "notFound" && <p className={styles.message}>This case is no longer on the board.</p>}
      {result?.kind === "failed" && (
        <div className={styles.message} role="alert">
          <p>Unable to load this case.</p>
          <button type="button" className={styles.retry} onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {detail && <Overview detail={detail} />}
    </aside>
  );
}

function CaseLine({ detail }: { detail: CaseDetail }) {
  const now = useNow();

  return (
    <p className={styles.caseLine}>
      Case {detail.caseNumber}
      <span className={styles.separator} aria-hidden="true">·</span>
      {checkInLabel(detail.arrivalTime, now)}
    </p>
  );
}

function Overview({ detail }: { detail: CaseDetail }) {
  const now = useNow();
  const { patient, owner } = detail;
  const kind = speciesKind(patient.species);
  const meta = [patient.species, patient.breed, longAgeLabel(patient.dateOfBirth, now), weightLabel(detail.weightKg)]
    .filter(Boolean)
    .join(" · ");
  const vitals = detail.vitals[0];
  const tiles = [
    ["Heart rate", vitals?.heartRate == null ? null : `${vitals.heartRate} bpm`],
    ["Resp rate", vitals?.respiratoryRate == null ? null : `${vitals.respiratoryRate} /min`],
    ["Temp", temperatureLabel(vitals?.temperatureF ?? null)],
    // SpO₂ is stored from 4.8a.
    ["SpO₂", null]
  ];
  const blockers = detail.tasks.filter((task) => task.type === "blocker" && task.status === "open");
  const tasks = detail.tasks.filter((task) => task.type === "task" && task.status !== "cancelled");

  return (
    <>
      <div className={styles.hero}>
        <span className={styles.avatar} data-species={kind} aria-hidden="true">{avatars[kind]}</span>
        <div>
          <h3 className={styles.name}>{patient.name}</h3>
          <p className={styles.meta}>{meta}</p>
        </div>
        <span className={styles.badge}>
          <AcuityBadge acuity={detail.acuity} isProvisional={detail.stage === "incoming"} />
        </span>
      </div>

      <div className={styles.ownerBar}>
        <div>
          <p className={styles.ownerLabel}>Pet parent</p>
          <p className={styles.ownerName}>
            {owner ? `${owner.firstName} ${owner.lastName}` : "No pet parent recorded"}
          </p>
        </div>
        {owner && (
          <div className={styles.ownerActions}>
            <button type="button" className={styles.linkButton} disabled>
              <span aria-hidden="true">☎ </span>Call
            </button>
            <button type="button" className={styles.linkButton} disabled>Message</button>
          </div>
        )}
      </div>

      <dl className={styles.vitals} aria-label="Latest vitals">
        {tiles.map(([label, value]) => (
          <div key={label} className={styles.vital}>
            <dt className={styles.vitalLabel}>{label}</dt>
            <dd className={styles.vitalValue}>{value ?? notRecorded}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.locationSection}>
        <p className={styles.row}>
          <span aria-hidden="true">📍</span>
          <span className={styles.rowLabel}>Location</span>
          <span className={styles.rowMeta}>{locationLabel(detail.room)}</span>
        </p>
      </div>

      <section className={styles.section} aria-labelledby={`${detail.id}-timeline`}>
        <h3 id={`${detail.id}-timeline`} className={styles.sectionTitle}>Care timeline</h3>
        {detail.timeline.length === 0 && blockers.length === 0 ? (
          <p className={styles.empty}>No events yet.</p>
        ) : (
          <ol className={styles.timeline}>
            {detail.timeline.map((caseEvent) => (
              <li key={caseEvent.id} className={styles.event}>
                <div className={styles.eventLine}>
                  <span className={styles.eventName}>{eventLabel(caseEvent.type)}</span>
                  <span className={styles.eventTime}>{timeLabel(caseEvent.createdAt, now)}</span>
                </div>
                <p className={styles.eventDetail}>{eventDetail(caseEvent)}</p>
              </li>
            ))}
            {blockers.map((blocker) => (
              <li key={blocker.id} className={styles.event} data-pending="true">
                <div className={styles.eventLine}>
                  <span className={styles.eventName}>{blocker.description}</span>
                  <span className={styles.eventTime}>Waiting</span>
                </div>
                <p className={styles.eventDetail}>
                  {blocker.assignedTo ? `Open blocker · ${blocker.assignedTo.name}` : "Open blocker"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.section} aria-labelledby={`${detail.id}-actions`}>
        <div className={styles.sectionTop}>
          <h3 id={`${detail.id}-actions`} className={styles.sectionTitle}>Next actions</h3>
          <button type="button" className={styles.linkButton} disabled>＋ Add task</button>
        </div>
        {tasks.length === 0 ? (
          <p className={styles.empty}>No tasks yet.</p>
        ) : (
          <ul className={styles.tasks}>
            {tasks.map((task) => {
              const isDone = task.status === "done";
              return (
                <li key={task.id} className={styles.row} data-done={isDone}>
                  <span className={styles.check} role="img" aria-label={isDone ? "Done" : "Open"}>
                    {isDone ? "✓" : ""}
                  </span>
                  <span className={styles.rowLabel}>{task.description}</span>
                  <span className={styles.rowMeta}>{taskMeta(task)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.secondary}`} disabled>
          <span aria-hidden="true">⇄ </span>Handoff
        </button>
        <button type="button" className={styles.button} disabled>Update status</button>
      </div>
    </>
  );
}

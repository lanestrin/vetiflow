import { useId } from "react";
import type { BoardSummary } from "../../types/BoardSummary";
import type { DemoRole } from "../shell/demoRoleContext";
import { shiftChipLabel } from "./boardFormat";
import styles from "./BoardHeading.module.scss";

interface BoardHeadingProps {
  // Null while the summary is unavailable; keep the board heading and intake.
  summary: BoardSummary | null;
  onIntake: () => void;
  // The Demo role switch (2.28) and who that role acts as ("J. Lee").
  demoRole: DemoRole;
  demoIdentity: string;
  onDemoRoleChange: (role: DemoRole) => void;
}

// The prototype's compact .workspace-header (header.png, 2.26b): the bell and
// signed-in user stay in the top bar; the demo-role row sits under the title
// (2.28).
export function BoardHeading({ summary, onIntake, demoRole, demoIdentity, onDemoRoleChange }: BoardHeadingProps) {
  const roleId = useId();
  return (
    <header className={styles.heading}>
      <div>
        {summary && <p className={styles.eyebrow}>{summary.clinicName}</p>}
        <h1 className={styles.title}>ER Command Center</h1>
        <div className={styles.demoRow}>
          <div className={styles.demoBox}>
            <label htmlFor={`${roleId}-role`}>Demo role</label>
            <select id={`${roleId}-role`} className={styles.demoSelect} value={demoRole} aria-describedby={`${roleId}-note`}
              onChange={(event) => onDemoRoleChange(event.target.value === "technician" ? "technician" : "veterinarian")}>
              <option value="veterinarian">Veterinarian</option>
              <option value="technician">Technician</option>
            </select>
            <span className={styles.demoIdentity}>{demoIdentity}</span>
          </div>
          <span id={`${roleId}-note`} className={styles.demoNote}>Simulated access · sign-in unchanged</span>
        </div>
      </div>
      <div className={styles.headRight}>
        {summary && (
          <p className={styles.shift}>
            <span className={styles.live} aria-hidden="true" />
            {shiftChipLabel(summary)}
          </p>
        )}
        <button type="button" className={styles.intakeButton} onClick={onIntake}>
          <span aria-hidden="true">＋ </span>New intake
        </button>
      </div>
    </header>
  );
}

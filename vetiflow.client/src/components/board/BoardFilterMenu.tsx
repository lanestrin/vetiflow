import { useEffect, useId, useRef, useState } from "react";
import type { CaseStatus, EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { caseStatusLabel, noMenuFilters, unassignedClinician, type BoardMenuFilters } from "./boardFormat";
import boardStyles from "./PatientFlowBoard.module.scss";
import styles from "./BoardFilterMenu.module.scss";

interface BoardFilterMenuProps {
  cases: EmergencyCaseListItem[];
  filters: BoardMenuFilters;
  onChange: (filters: BoardMenuFilters) => void;
}

interface Option {
  value: string;
  label: string;
}

function byLabel(first: Option, second: Option): number {
  return first.label.localeCompare(second.label);
}

// Each value once, keeping a chosen one even when no card has it any more,
// so the selection never jumps after a reload.
function uniqueOptions(options: Option[], chosen: Option | null): Option[] {
  const byValue = new Map(options.map((option) => [option.value, option]));
  if (chosen !== null && !byValue.has(chosen.value)) {
    byValue.set(chosen.value, chosen);
  }

  return [...byValue.values()].sort(byLabel);
}

function clinicianOptions(cases: EmergencyCaseListItem[], chosenId: string | null): Option[] {
  const onBoard = cases.flatMap((emergencyCase) =>
    emergencyCase.clinician ? [{ value: emergencyCase.clinician.id, label: emergencyCase.clinician.shortName }] : []);
  const chosen = chosenId !== null && chosenId !== unassignedClinician
    ? { value: chosenId, label: onBoard.find((option) => option.value === chosenId)?.label ?? "Clinician" }
    : null;

  return uniqueOptions(onBoard, chosen);
}

function speciesOptions(cases: EmergencyCaseListItem[], chosen: string | null): Option[] {
  const onBoard = cases.map((emergencyCase) => ({ value: emergencyCase.species, label: emergencyCase.species }));
  return uniqueOptions(onBoard, chosen === null ? null : { value: chosen, label: chosen });
}

function statusOptions(cases: EmergencyCaseListItem[], chosen: CaseStatus | null): Option[] {
  const onBoard = cases.map((emergencyCase) => ({ value: emergencyCase.status, label: caseStatusLabel(emergencyCase.status) }));
  return uniqueOptions(onBoard, chosen === null ? null : { value: chosen, label: caseStatusLabel(chosen) });
}

function filtersInUse(filters: BoardMenuFilters): number {
  return [filters.clinicianId, filters.species, filters.status].filter((value) => value !== null).length;
}

// The board's **Filter** (build plan 2.14c). The prototype has only the
// button; the menu follows its look and the profile menu's behaviour:
// Escape or a press outside closes it. Choosing an option filters at once.
export function BoardFilterMenu({ cases, filters, onChange }: BoardFilterMenuProps) {
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inUse = filtersInUse(filters);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={styles.filter} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={boardStyles.toolButton}
        aria-pressed={inUse > 0}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={inUse > 0 ? `Filter, ${inUse} in use` : "Filter"}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">⚑ </span>
        <span className={boardStyles.toolLabel}>Filter</span>
        {inUse > 0 && <> <b>{inUse}</b></>}
      </button>
      <div id={menuId} className={styles.menu} hidden={!isOpen}>
        <label className={styles.field}>
          <span className={styles.label}>Clinician</span>
          <select
            className={styles.select}
            value={filters.clinicianId ?? ""}
            onChange={(event) => onChange({ ...filters, clinicianId: event.target.value || null })}
          >
            <option value="">Any clinician</option>
            <option value={unassignedClinician}>Unassigned</option>
            {clinicianOptions(cases, filters.clinicianId).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Species</span>
          <select
            className={styles.select}
            value={filters.species ?? ""}
            onChange={(event) => onChange({ ...filters, species: event.target.value || null })}
          >
            <option value="">Any species</option>
            {speciesOptions(cases, filters.species).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Case status</span>
          <select
            className={styles.select}
            value={filters.status ?? ""}
            onChange={(event) => onChange({ ...filters, status: (event.target.value || null) as CaseStatus | null })}
          >
            <option value="">Any status</option>
            {statusOptions(cases, filters.status).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {inUse > 0 && (
          <button type="button" className={styles.clear} onClick={() => onChange(noMenuFilters)}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

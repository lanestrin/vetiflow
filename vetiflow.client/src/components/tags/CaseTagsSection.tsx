import { useId, type RefObject } from "react";
import type { CaseTag } from "../../types/CaseTag";
import { caseTagMaxCount, caseTagToneLabel } from "./caseTagRules";
import styles from "./CaseTagsSection.module.scss";

interface CaseTagsSectionProps {
  tags: CaseTag[];
  isDischarged: boolean;
  removeError: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  addButtonRef: RefObject<HTMLButtonElement | null>;
  onAdd: () => void;
  onRemove: (tag: CaseTag) => void;
}

// The case's tags in the patient panel (build plan 3.5b): each with its tone in
// words and a remove button, and an Add tag button. Discharged cases are read
// only, and adding stops at the limit.
export function CaseTagsSection({
  tags,
  isDischarged,
  removeError,
  headingRef,
  addButtonRef,
  onAdd,
  onRemove
}: CaseTagsSectionProps) {
  const id = useId();
  const atLimit = tags.length >= caseTagMaxCount;

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} ref={headingRef} tabIndex={-1} className={styles.title}>Tags</h3>
      {removeError && <p className={styles.error} role="alert">{removeError}</p>}
      {tags.length === 0
        ? <p className={styles.empty}>No tags recorded</p>
        : (
          <ul className={styles.list} aria-label="Case tags">
            {tags.map((tag) => (
              <li key={tag.id} className={styles.item} data-tone={tag.tone}>
                <span className={styles.text}>{tag.text}</span>
                <span className={styles.tone}>{caseTagToneLabel(tag.tone)}</span>
                {!isDischarged && (
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove tag ${tag.text}`}
                    onClick={() => onRemove(tag)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      {!isDischarged && (
        <>
          <button ref={addButtonRef} type="button" className={styles.add} onClick={onAdd} disabled={atLimit}>
            Add tag
          </button>
          {atLimit && <p className={styles.empty}>This case has {caseTagMaxCount} tags.</p>}
        </>
      )}
    </section>
  );
}

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import styles from "./MoreActionsMenu.module.scss";

export interface MoreAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface MoreActionsMenuProps {
  actions: MoreAction[];
  actionButtonRef?: RefObject<HTMLButtonElement | null>;
}

// The panel's **•••** (prototype `#more`): a button that shows a short list of
// case actions. Disabled when there are none. Escape closes it and returns
// focus to the button; a click outside closes it.
export function MoreActionsMenu({ actions, actionButtonRef }: MoreActionsMenuProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    containerRef.current?.querySelector<HTMLButtonElement>("li button")?.focus();

    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.stopPropagation();
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={element => {
          buttonRef.current = element;
          if (actionButtonRef) actionButtonRef.current = element;
        }}
        type="button"
        className={styles.toggle}
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        disabled={actions.length === 0}
        onClick={() => setIsOpen((open) => !open)}
      >
        •••
      </button>
      {isOpen && (
        <ul id={listId} className={styles.list}>
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                className={styles.item}
                disabled={action.disabled}
                onClick={() => {
                  setIsOpen(false);
                  action.onSelect();
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAccessToken } from "../../services/session";
import type { SignedInUser } from "../../types/Auth";
import styles from "./AppShell.module.scss";
import { MyStatusControl } from "./MyStatusControl";
import { useClinicalDraftNavigation } from "../forms/clinicalDraftContext";

interface ProfileMenuProps {
  user: SignedInUser;
}

// The top bar's profile: avatar and display name, opening the way out.
// Escape or a click elsewhere closes it. Signing out forgets this tab's token,
// so the guards send the back button to sign-in.
export function ProfileMenu({ user }: ProfileMenuProps) {
  const navigate = useNavigate();
  const drafts = useClinicalDraftNavigation();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  function signOut() {
    void drafts.requestLeave(() => {
      clearAccessToken();
      navigate("/sign-in", { replace: true });
    });
  }

  return (
    <div className={styles.profile} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.profileButton}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`${user.displayName}, account`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.avatar} aria-hidden="true">{user.initials}</span>
        <span className={styles.profileName} aria-hidden="true">{user.displayName}</span>
      </button>
      <div id={menuId} className={styles.profileMenu} hidden={!isOpen}>
        <p className={styles.profileMenuName}>
          {user.displayName} <span className={styles.demoNote}>(demo)</span>
        </p>
        {/* Reloaded each time the menu opens (2.21b). */}
        {isOpen && <MyStatusControl />}
        <button type="button" className={styles.signOut} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

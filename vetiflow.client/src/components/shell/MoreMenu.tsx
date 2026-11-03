import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreIcon } from "./shellIcons";
import styles from "./AppShell.module.scss";

export interface MorePage {
  path: string;
  label: string;
  icon: ReactNode;
}

interface MoreMenuProps {
  pages: MorePage[];
}

// The phone bar's last item (2.27b): the destinations that do not fit in the
// bar. Escape or a press elsewhere closes it, as the profile menu does, and so
// does any navigation.
export function MoreMenu({ pages }: MoreMenuProps) {
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const [openedAt, setOpenedAt] = useState(location.key);
  const isCurrent = pages.some((page) => location.pathname === page.path || location.pathname.startsWith(`${page.path}/`));

  if (openedAt !== location.key) {
    setOpenedAt(location.key);
    setIsOpen(false);
  }

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
    <div className={styles.more} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.navIcon}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-current={isCurrent ? "true" : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MoreIcon />
        <span className={styles.navLabel}>More</span>
      </button>
      <ul id={menuId} className={styles.moreMenu} hidden={!isOpen}>
        {pages.map((page) => (
          <li key={page.path}>
            <NavLink to={page.path} className={styles.moreLink} onClick={() => setIsOpen(false)}>
              {page.icon}
              {page.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

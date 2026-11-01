import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { SignedInUser } from "../../types/Auth";
import { ProfileMenu } from "./ProfileMenu";
import { ShellSearchContext } from "./shellSearchContext";
import {
  BellIcon,
  BoardIcon,
  OverviewIcon,
  PatientsIcon,
  ReportsIcon,
  SearchIcon,
  SettingsIcon,
  TeamIcon
} from "./shellIcons";
import { ToastProvider } from "./Toast";
import { useToast } from "./toastContext";
import styles from "./AppShell.module.scss";

interface ShellPage {
  path: string;
  // The rail link's name, and the breadcrumb's.
  label: string;
  crumb: string;
  icon: ReactNode;
}

// The rail, top to bottom, as in the prototype. Settings sits at the bottom.
const shellPages: ShellPage[] = [
  { path: "/overview", label: "Overview", crumb: "Overview", icon: <OverviewIcon /> },
  { path: "/er", label: "ER board", crumb: "ER Command Center", icon: <BoardIcon /> },
  { path: "/records", label: "Patients", crumb: "Patients", icon: <PatientsIcon /> },
  { path: "/team", label: "Team", crumb: "Team", icon: <TeamIcon /> },
  { path: "/reports", label: "Reports", crumb: "Reports", icon: <ReportsIcon /> },
  { path: "/settings", label: "Settings", crumb: "Settings", icon: <SettingsIcon /> }
];

const settingsPage = shellPages[shellPages.length - 1];
const railPages = shellPages.slice(0, -1);
const mobileNavigationQuery = "(max-width: 760px)";

interface AppShellProps {
  user: SignedInUser;
  children: ReactNode;
}

// The ER Command Center's frame around every staff page (build plan 2.10b):
// the navy rail and the top bar with breadcrumb, search, bell and profile.
export function AppShell({ user, children }: AppShellProps) {
  const [search, setSearch] = useState("");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const location = useLocation();
  const [navigationLocation, setNavigationLocation] = useState(location.key);
  const mobileNavigationToggleRef = useRef<HTMLButtonElement>(null);
  const firstNavigationLinkRef = useRef<HTMLAnchorElement>(null);

  // Search and browser history navigate without clicking a rail destination.
  if (navigationLocation !== location.key) {
    setNavigationLocation(location.key);
    setMobileNavigationOpen(false);
  }

  useEffect(() => {
    const media = window.matchMedia?.(mobileNavigationQuery);
    if (!media) return;
    function resetOnDesktop(event: MediaQueryListEvent) {
      if (!event.matches) {
        setMobileNavigationOpen(false);
        if (document.activeElement === mobileNavigationToggleRef.current) {
          firstNavigationLinkRef.current?.focus();
        }
      }
    }
    media.addEventListener("change", resetOnDesktop);
    return () => media.removeEventListener("change", resetOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    firstNavigationLinkRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && window.matchMedia?.(mobileNavigationQuery).matches !== false) {
        event.preventDefault();
        setMobileNavigationOpen(false);
        mobileNavigationToggleRef.current?.focus();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavigationOpen]);

  function closeMobileNavigation() {
    if (!mobileNavigationOpen) {
      return;
    }

    setMobileNavigationOpen(false);
    if (window.matchMedia?.(mobileNavigationQuery).matches !== false) {
      mobileNavigationToggleRef.current?.focus();
    }
  }

  return (
    <ToastProvider>
      <div className={styles.app}>
        <nav
          id="main-navigation"
          className={styles.rail}
          aria-label="Main"
          data-mobile-open={mobileNavigationOpen}
        >
          <div className={styles.railBrand}>
            <span className={styles.brandmark} aria-hidden="true">V</span>
            <span className={styles.brandName}>VetiFlow</span>
          </div>
          <ul className={styles.railNav}>
            {railPages.map((page, index) => (
              <li key={page.path}>
                <RailLink
                  page={page}
                  onNavigate={closeMobileNavigation}
                  linkRef={index === 0 ? firstNavigationLinkRef : undefined}
                />
              </li>
            ))}
          </ul>
          <div className={styles.railBottom}>
            <RailLink page={settingsPage} onNavigate={closeMobileNavigation} />
          </div>
        </nav>
        <div className={styles.main}>
          <TopBar
            user={user}
            search={search}
            onSearchChange={setSearch}
            mobileNavigationOpen={mobileNavigationOpen}
            onToggleMobileNavigation={() => setMobileNavigationOpen((open) => !open)}
            mobileNavigationToggleRef={mobileNavigationToggleRef}
          />
          <ShellSearchContext value={search}>{children}</ShellSearchContext>
        </div>
      </div>
    </ToastProvider>
  );
}

interface RailLinkProps {
  page: ShellPage;
  onNavigate: () => void;
  linkRef?: Ref<HTMLAnchorElement>;
}

function RailLink({ page, onNavigate, linkRef }: RailLinkProps) {
  return (
    <NavLink
      ref={linkRef}
      to={page.path}
      className={styles.navIcon}
      aria-label={page.label}
      title={page.label}
      onClick={onNavigate}
    >
      {page.icon}
      <span className={styles.navLabel}>{page.label}</span>
    </NavLink>
  );
}

interface TopBarProps {
  user: SignedInUser;
  search: string;
  onSearchChange: (search: string) => void;
  mobileNavigationOpen: boolean;
  onToggleMobileNavigation: () => void;
  mobileNavigationToggleRef: Ref<HTMLButtonElement>;
}

function TopBar({
  user,
  search,
  onSearchChange,
  mobileNavigationOpen,
  onToggleMobileNavigation,
  mobileNavigationToggleRef
}: TopBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const showToast = useToast();
  // A patient's profile (/records/:patientId) sits under Patients.
  const crumb = shellPages.find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`))?.crumb;

  // Patients runs the search (4.6a); the board also filters as you type (2.14a).
  function openPatientSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = search.trim();
    navigate(text === "" ? "/records" : `/records?search=${encodeURIComponent(text)}`);
    onSearchChange("");
  }

  return (
    <header className={styles.topbar}>
      <button
        ref={mobileNavigationToggleRef}
        type="button"
        className={styles.mobileMenuToggle}
        aria-label={mobileNavigationOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileNavigationOpen}
        aria-controls="main-navigation"
        onClick={onToggleMobileNavigation}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {mobileNavigationOpen
            ? <path d="m6 6 12 12M18 6 6 18" />
            : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      <p className={styles.crumb}>
        VetiFlow <span className={styles.crumbSeparator} aria-hidden="true">/</span> <b>{crumb}</b>
      </p>
      <div className={styles.topRight}>
        <form className={styles.search} role="search" aria-label="Quick search" onSubmit={openPatientSearch}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            type="search"
            aria-label="Search patients"
            placeholder="Search patients…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </form>
        <Link className={styles.searchLink} to="/records" aria-label="Search patients">
          <SearchIcon />
        </Link>
        <button
          type="button"
          className={styles.topIcon}
          aria-label="Notifications"
          onClick={() => showToast("No notifications yet")}
        >
          <BellIcon />
        </button>
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}

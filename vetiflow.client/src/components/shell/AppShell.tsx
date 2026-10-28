import { useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { SignedInUser } from "../../types/Auth";
import { ProfileMenu } from "./ProfileMenu";
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

interface AppShellProps {
  user: SignedInUser;
  children: ReactNode;
}

// The ER Command Center's frame around every staff page (build plan 2.10b):
// the navy rail and the top bar with breadcrumb, search, bell and profile.
export function AppShell({ user, children }: AppShellProps) {
  return (
    <ToastProvider>
      <div className={styles.app}>
        <nav className={styles.rail} aria-label="Main">
          <span className={styles.brandmark} aria-hidden="true">V</span>
          <ul className={styles.railNav}>
            {railPages.map((page) => (
              <li key={page.path}>
                <RailLink page={page} />
              </li>
            ))}
          </ul>
          <div className={styles.railBottom}>
            <RailLink page={settingsPage} />
          </div>
        </nav>
        <div className={styles.main}>
          <TopBar user={user} />
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}

function RailLink({ page }: { page: ShellPage }) {
  return (
    <NavLink to={page.path} className={styles.navIcon} aria-label={page.label} title={page.label}>
      {page.icon}
    </NavLink>
  );
}

function TopBar({ user }: { user: SignedInUser }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const showToast = useToast();
  const [search, setSearch] = useState("");
  const crumb = shellPages.find((page) => page.path === pathname)?.crumb;

  // Patients runs the search (4.6a); filtering the board as you type is 2.14.
  function openPatientSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = search.trim();
    navigate(text === "" ? "/records" : `/records?search=${encodeURIComponent(text)}`);
    setSearch("");
  }

  return (
    <header className={styles.topbar}>
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
            onChange={(event) => setSearch(event.target.value)}
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

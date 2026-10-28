// The ER Command Center's line icons, from
// blueprint/reference/vetiflow-er-dashboard.html. Decorative: the link or
// button around each one carries its name.

export function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16M4 12h16M4 19h16" />
      <circle cx="8" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="10" cy="19" r="1" />
    </svg>
  );
}

export function PatientsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" />
      <path d="M12 9v6m-3-3h6" />
    </svg>
  );
}

export function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.8M18 15c2 .5 3 2.1 3 4" />
    </svg>
  );
}

export function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="m19.4 15 .1.1 1.1 1.9-1.8 3.1-2.2-.4a7.8 7.8 0 0 1-1.6.9l-.7 2.1h-3.6L10 20.6a7.8 7.8 0 0 1-1.6-.9l-2.2.4-1.8-3.1 1.1-1.9a7 7 0 0 1 0-1.9l-1.1-1.9 1.8-3.1 2.2.4A7.8 7.8 0 0 1 10 7.7l.7-2.1h3.6l.7 2.1a7.8 7.8 0 0 1 1.6.9l2.2-.4 1.8 3.1-1.1 1.9a7 7 0 0 1-.1 1.8Z"
        transform="translate(-1 -1) scale(.95)"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

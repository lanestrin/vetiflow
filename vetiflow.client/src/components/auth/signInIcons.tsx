import type { ReactNode } from "react";

// Line icons from the landing design (build plan S.20a). Every
// one is decorative: the text beside it carries the meaning.
function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function MailIcon() {
  return (
    <LineIcon>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </LineIcon>
  );
}

export function PhoneIcon() {
  return (
    <LineIcon>
      <path d="M6.4 3.8 9 3a1.5 1.5 0 0 1 1.8.9l1 2.7a1.5 1.5 0 0 1-.6 1.8l-1.6 1c1.1 2.1 3 4 5.1 5.1l1-1.6a1.5 1.5 0 0 1 1.8-.6l2.7 1A1.5 1.5 0 0 1 21 15l-.8 2.6a2.5 2.5 0 0 1-2.8 1.7A18 18 0 0 1 4.7 6.6a2.5 2.5 0 0 1 1.7-2.8Z" />
    </LineIcon>
  );
}

export function MapPinIcon() {
  return (
    <LineIcon>
      <path d="M12 21s7-7.1 7-12a7 7 0 0 0-14 0c0 4.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </LineIcon>
  );
}

export function LockIcon() {
  return (
    <LineIcon>
      <rect x="5.5" y="10" width="13" height="10.5" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </LineIcon>
  );
}

export function EyeIcon() {
  return (
    <LineIcon>
      <path d="M2.7 12s3.3-6 9.3-6 9.3 6 9.3 6-3.3 6-9.3 6-9.3-6-9.3-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </LineIcon>
  );
}

export function EyeOffIcon() {
  return (
    <LineIcon>
      <path d="M2.7 12s3.3-6 9.3-6 9.3 6 9.3 6-3.3 6-9.3 6-9.3-6-9.3-6Z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4 4l16 16" />
    </LineIcon>
  );
}

export function ShieldIcon() {
  return (
    <LineIcon>
      <path d="M12 2.5 20 6v6.1c0 4.4-2.6 7.8-8 9.6-5.4-1.8-8-5.2-8-9.6V6z" />
      <path d="m8.2 12.1 2.4 2.3 5.1-5.2" />
    </LineIcon>
  );
}

export function CareUpdatesIcon() {
  return (
    <LineIcon>
      <rect x="4.25" y="4" width="15.5" height="17" rx="2" />
      <path d="M9 4.5h6V2.75H9zM8 11h8M12 8v7" />
    </LineIcon>
  );
}

export function MessageIcon() {
  return (
    <LineIcon>
      <path d="M20 11.4a7.5 7.5 0 0 1-7.5 7.5H9l-4.5 2v-4.7A7.5 7.5 0 1 1 20 11.4z" />
      <circle cx="8.8" cy="11.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="11.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="16.2" cy="11.5" r=".9" fill="currentColor" stroke="none" />
    </LineIcon>
  );
}

export function PeopleIcon() {
  return (
    <LineIcon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.7 18.5v-1.3A5.2 5.2 0 0 1 8.9 12h.2a5.2 5.2 0 0 1 5.2 5.2v1.3zM17 11a3 3 0 1 0-.7-5.9M16.2 13.5a4.5 4.5 0 0 1 4.1 4.5v.5h-3.7" />
    </LineIcon>
  );
}

// Beside a field error or a failed sign-in.
export function AlertIcon() {
  return (
    <LineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </LineIcon>
  );
}

// Beside good news, such as "the demo code is ready".
export function CheckIcon() {
  return (
    <LineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.7 2.7L16 9.8" />
    </LineIcon>
  );
}

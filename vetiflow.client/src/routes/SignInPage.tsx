import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { EmailSignInForm } from "../components/auth/EmailSignInForm";
import { PhoneSignInForm } from "../components/auth/PhoneSignInForm";
import { experienceHome, type SignInRouteState } from "../components/auth/experienceHome";
import { useSession } from "../components/auth/useSession";
import { SignInBrandPanel } from "../components/auth/SignInBrandPanel";
import { SignInSuccess } from "../components/auth/SignInSuccess";
import { clearAccessToken } from "../services/session";
import type { SignedInUser } from "../types/Auth";
import styles from "./SignInPage.module.scss";

type SignInMethod = "email" | "phone";

const methods: { method: SignInMethod; label: string }[] = [
  { method: "email", label: "Email" },
  { method: "phone", label: "Phone" }
];

// The demo sign-in page (build plan S.18a), laid out as
// blueprint/reference/vetiflow-login-mock.html.
const sessionEndedMessage = "Your session ended. Sign in again.";

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const routeState = location.state as SignInRouteState | null;
  const [method, setMethod] = useState<SignInMethod>("email");
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const demoSummaryRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<SignInMethod, HTMLButtonElement | null>>({ email: null, phone: null });

  // Success replaces the form, so move focus to the new heading.
  useEffect(() => {
    if (signedInUser) {
      headingRef.current?.focus();
    }
  }, [signedInUser]);

  function selectMethod(next: SignInMethod) {
    setMethod(next);
    tabRefs.current[next]?.focus();
  }

  // The ARIA tabs pattern: arrows move between tabs, Home and End jump.
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = methods.findIndex((entry) => entry.method === method);
    const keyTargets: Record<string, number> = {
      ArrowRight: (index + 1) % methods.length,
      ArrowLeft: (index - 1 + methods.length) % methods.length,
      Home: 0,
      End: methods.length - 1
    };

    if (event.key in keyTargets) {
      event.preventDefault();
      selectMethod(methods[keyTargets[event.key]].method);
    }
  }

  function openDemo() {
    setIsDemoOpen(true);
    demoSummaryRef.current?.focus();
  }

  function backToSignIn() {
    clearAccessToken();
    setSignedInUser(null);
    setMethod("email");
  }

  function continueToExperience() {
    if (signedInUser) {
      navigate(signedInUser.experience === "teamMember" ? "/er" : "/pet-parent");
    }
  }

  // Already signed in when the page opened: go straight home.
  if (session.kind === "signedIn" && !signedInUser) {
    return <Navigate to={experienceHome[session.user.experience]} replace />;
  }

  return (
    <div className={styles.shell}>
      <title>Sign in · VetiFlow</title>
      <SignInBrandPanel />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <button type="button" className={styles.topLink} onClick={openDemo}>
            Help
          </button>
        </div>

        <div className={styles.content}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
            {signedInUser ? "You're all set" : "Welcome back"}
          </h1>
          <p className={styles.subheading}>
            {signedInUser
              ? "We found your account."
              : "Sign in to continue. We'll find the right portal for your account."}
          </p>

          {signedInUser ? (
            <SignInSuccess
              user={signedInUser}
              onContinue={continueToExperience}
              onBack={backToSignIn}
            />
          ) : (
            <>
              <div className={styles.tabs} role="tablist" aria-label="Sign-in method">
                {methods.map((entry) => (
                  <button
                    key={entry.method}
                    ref={(element) => {
                      tabRefs.current[entry.method] = element;
                    }}
                    id={`sign-in-tab-${entry.method}`}
                    type="button"
                    role="tab"
                    className={styles.tab}
                    aria-selected={method === entry.method}
                    aria-controls={`sign-in-panel-${entry.method}`}
                    tabIndex={method === entry.method ? 0 : -1}
                    onClick={() => setMethod(entry.method)}
                    onKeyDown={handleTabKeyDown}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div
                id="sign-in-panel-email"
                role="tabpanel"
                aria-labelledby="sign-in-tab-email"
                hidden={method !== "email"}
              >
                <EmailSignInForm
                  onSignedIn={setSignedInUser}
                  notice={routeState?.sessionEnded ? sessionEndedMessage : undefined}
                />
              </div>
              <div
                id="sign-in-panel-phone"
                role="tabpanel"
                aria-labelledby="sign-in-tab-phone"
                hidden={method !== "phone"}
              >
                <PhoneSignInForm onSignedIn={setSignedInUser} />
              </div>

              <p className={styles.divider}>Secure access</p>
              <div className={styles.note}>
                <span className={styles.shield} aria-hidden="true">✓</span>
                <span>
                  <strong className={styles.noteTitle}>Your account picks up where you belong</strong>
                  <span className={styles.noteText}>
                    Hospital team or pet parent access is recognized after sign-in.
                  </span>
                </span>
              </div>

              <details
                className={styles.demo}
                open={isDemoOpen}
                onToggle={(event) => setIsDemoOpen(event.currentTarget.open)}
              >
                <summary ref={demoSummaryRef} className={styles.demoSummary}>Try the demo</summary>
                <dl className={styles.demoList}>
                  <dt>Email</dt>
                  <dd><code>team@vetiflow.demo</code> or <code>parent@vetiflow.demo</code></dd>
                  <dt>Password</dt>
                  <dd><code>welcome1</code></dd>
                  <dt>Phone</dt>
                  <dd><code>312-555-0101</code> or <code>312-555-0102</code></dd>
                  <dt>Demo code</dt>
                  <dd><code>123456</code></dd>
                </dl>
              </details>

              <p className={styles.footer}>New to VetiFlow? Ask your hospital team for an invite.</p>
            </>
          )}

          <p className={styles.tiny}>Proof of concept · Demo accounts only</p>
        </div>
      </main>
    </div>
  );
}

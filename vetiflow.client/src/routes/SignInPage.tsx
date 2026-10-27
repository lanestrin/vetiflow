import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { EmailSignInForm } from "../components/auth/EmailSignInForm";
import { EmergencyBar } from "../components/auth/EmergencyBar";
import { PhoneSignInForm } from "../components/auth/PhoneSignInForm";
import { experienceHome, type SignInRouteState } from "../components/auth/experienceHome";
import { useSession } from "../components/auth/useSession";
import { SignInBenefits, SignInBrand, SignInStory } from "../components/auth/SignInStory";
import { SignInScene } from "../components/auth/SignInScene";
import { SignInSuccess } from "../components/auth/SignInSuccess";
import { MailIcon, PhoneIcon, ShieldIcon } from "../components/auth/signInIcons";
import { useMeasuredHeight } from "../components/auth/useMeasuredHeight";
import { clearAccessToken } from "../services/session";
import type { SignedInUser } from "../types/Auth";
import styles from "./SignInPage.module.scss";

type SignInMethod = "email" | "phone";

const methods: { method: SignInMethod; label: string; icon: ReactNode }[] = [
  { method: "email", label: "Email", icon: <MailIcon /> },
  { method: "phone", label: "Phone", icon: <PhoneIcon /> }
];

// The demo sign-in page (build plan S.18a), laid out as the landing design in
// blueprint/reference/landing-page (S.20a).
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
  const [emailPanel, setEmailPanel] = useState<HTMLDivElement | null>(null);
  const [phonePanel, setPhonePanel] = useState<HTMLDivElement | null>(null);
  // The panels' wrapper eases to the visible form's height.
  const panelHeight = useMeasuredHeight(method === "email" ? emailPanel : phonePanel);
  const panelsStyle =
    panelHeight === undefined ? undefined : ({ "--panel-height": `${panelHeight}px` } as CSSProperties);

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
      {/* One art layer: behind the page on wide screens, a hero band on narrow ones. */}
      <div className={styles.art} aria-hidden="true">
        <SignInScene />
      </div>

      <div className={styles.brandArea}>
        <SignInBrand />
      </div>
      <div className={styles.storyArea}>
        <SignInStory />
      </div>

      <main className={styles.cardArea}>
        <div className={styles.card}>
          <div className={styles.topBar}>
            <button type="button" className={styles.topLink} onClick={openDemo}>
              Help
            </button>
          </div>

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
                {/* One highlight that slides under the selected tab. */}
                <span className={styles.tabHighlight} data-selected={method} aria-hidden="true" />
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
                    {entry.icon}
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className={styles.panels} style={panelsStyle}>
                <div
                  ref={setEmailPanel}
                  id="sign-in-panel-email"
                  className={styles.panelFromLeft}
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
                  ref={setPhonePanel}
                  id="sign-in-panel-phone"
                  className={styles.panelFromRight}
                  role="tabpanel"
                  aria-labelledby="sign-in-tab-phone"
                  hidden={method !== "phone"}
                >
                  <PhoneSignInForm onSignedIn={setSignedInUser} />
                </div>
              </div>

              <p className={styles.divider}>Secure access</p>
              <div className={styles.note}>
                <span className={styles.shield}>
                  <ShieldIcon />
                </span>
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

      <div className={styles.benefitsArea}>
        <SignInBenefits />
      </div>
      <footer className={styles.tagline}>Thoughtful care. Clear communication.</footer>
      <div className={styles.emergencyArea}>
        <EmergencyBar />
      </div>
    </div>
  );
}

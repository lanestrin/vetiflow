import { useId, useState, type FormEvent } from "react";
import { getSignedInUser, signInByEmail } from "../../services/authApi";
import { clearAccessToken, saveAccessToken } from "../../services/session";
import type { SignedInUser, SignInFailure } from "../../types/Auth";
import { PrimaryButton } from "./PrimaryButton";
import styles from "./SignInForm.module.scss";

interface EmailSignInFormProps {
  onSignedIn: (user: SignedInUser) => void;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

// The demo's wording for each failure (project plan section 10). The API sends
// codes only; what people read lives here.
const failureMessages: Record<SignInFailure, string> = {
  unknownAccount: "We couldn't match that demo account. Try one of the sample emails below.",
  wrongPassword: "Use welcome1 for this demo account.",
  inactiveAccount: "This demo account is turned off.",
  unavailable: "Sign-in isn't available right now. Try again in a moment."
};

const forgotPasswordMessage = "Password reset is a placeholder in this no-cost demo.";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (email === "") {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Enter an email address like you@example.com.";
  }

  if (password === "") {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function EmailSignInForm({ onSignedIn }: EmailSignInFormProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const emailErrorId = `${id}-email-error`;
  const passwordErrorId = `${id}-password-error`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const errors = validate(trimmedEmail, password);
    setFieldErrors(errors);
    setMessage("");

    if (errors.email || errors.password) {
      return;
    }

    setIsSigningIn(true);
    const result = await signInByEmail(trimmedEmail, password);

    if (!result.ok) {
      setIsSigningIn(false);
      setMessage(failureMessages[result.failure]);
      return;
    }

    saveAccessToken(result.accessToken);

    try {
      const user = await getSignedInUser(result.accessToken);
      setPassword("");
      onSignedIn(user);
    } catch {
      clearAccessToken();
      setIsSigningIn(false);
      setMessage(failureMessages.unavailable);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-email`}>Email address</label>
        <input
          id={`${id}-email`}
          className={styles.input}
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? emailErrorId : undefined}
        />
        {fieldErrors.email && (
          <p id={emailErrorId} className={styles.fieldError}>{fieldErrors.email}</p>
        )}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`${id}-password`}>Password</label>
          <button
            type="button"
            className={styles.link}
            onClick={() => setMessage(forgotPasswordMessage)}
          >
            Forgot password?
          </button>
        </div>
        <input
          id={`${id}-password`}
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
        />
        {fieldErrors.password && (
          <p id={passwordErrorId} className={styles.fieldError}>{fieldErrors.password}</p>
        )}
      </div>

      <PrimaryButton type="submit" disabled={isSigningIn}>
        {isSigningIn ? "Signing in…" : "Sign in"}
        {!isSigningIn && <span aria-hidden="true"> →</span>}
      </PrimaryButton>

      <p className={styles.message} role="status" aria-live="polite">{message}</p>
    </form>
  );
}

import { useId, useState, type FormEvent } from "react";
import { finishSignIn, signInByEmail } from "../../services/authApi";
import type { SignedInUser } from "../../types/Auth";
import { PrimaryButton } from "./PrimaryButton";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "./signInIcons";
import { failureMessages } from "./signInMessages";
import styles from "./SignInForm.module.scss";

interface EmailSignInFormProps {
  onSignedIn: (user: SignedInUser) => void;
  // A message to show before anything is typed, such as "session ended".
  notice?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

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

export function EmailSignInForm({ onSignedIn, notice = "" }: EmailSignInFormProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState(notice);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isPasswordShown, setIsPasswordShown] = useState(false);

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

    try {
      const user = await finishSignIn(result.accessToken);
      setPassword("");
      onSignedIn(user);
    } catch {
      setIsSigningIn(false);
      setMessage(failureMessages.unavailable);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-email`}>Email address</label>
        <div className={styles.inputWrap}>
          <span className={styles.leadingIcon}><MailIcon /></span>
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
        </div>
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
        <div className={styles.inputWrap}>
          <span className={styles.leadingIcon}><LockIcon /></span>
          <input
            id={`${id}-password`}
            className={`${styles.input} ${styles.inputWithButton}`}
            type={isPasswordShown ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
          />
          <button
            type="button"
            className={styles.revealButton}
            aria-label={isPasswordShown ? "Hide password" : "Show password"}
            aria-pressed={isPasswordShown}
            onClick={() => setIsPasswordShown((shown) => !shown)}
          >
            {isPasswordShown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
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

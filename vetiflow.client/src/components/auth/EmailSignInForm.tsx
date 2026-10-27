import { useId, useRef, useState, type FormEvent } from "react";
import { finishSignIn, signInByEmail } from "../../services/authApi";
import type { SignedInUser, SignInFailure } from "../../types/Auth";
import { FieldError, StatusMessage } from "./FormMessages";
import { PrimaryButton } from "./PrimaryButton";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "./signInIcons";
import { failureMessages, noMessage, type FormMessage } from "./signInMessages";
import { useSignInRequest } from "./useSignInRequest";
import styles from "./SignInForm.module.scss";

interface EmailSignInFormProps {
  onSignedIn: (user: SignedInUser) => void;
  // False while the Phone tab is chosen: a running request is cancelled.
  isActive: boolean;
  // A message to show before anything is typed, such as "session ended".
  notice?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const forgotPasswordMessage = "Password reset is a placeholder in this no-cost demo.";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(email: string): string | undefined {
  if (email === "") {
    return "Enter your email address.";
  }

  return emailPattern.test(email) ? undefined : "Enter an email address like you@example.com.";
}

// Sign-in only needs the password filled in; the API checks it.
function passwordError(password: string): string | undefined {
  return password === "" ? "Enter your password." : undefined;
}

export function EmailSignInForm({ onSignedIn, isActive, notice = "" }: EmailSignInFormProps) {
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<FormMessage>(notice ? { text: notice, tone: "info" } : noMessage);
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const request = useSignInRequest(isActive);

  const emailErrorId = `${id}-email-error`;
  const passwordErrorId = `${id}-password-error`;

  // Errors appear on submit. After that, a field that was wrong is checked
  // again as it is corrected, so its error clears without another submit.
  function changeEmail(value: string) {
    setEmail(value);
    if (fieldErrors.email) {
      setFieldErrors((errors) => ({ ...errors, email: emailError(value.trim()) }));
    }
  }

  function changePassword(value: string) {
    setPassword(value);
    if (fieldErrors.password) {
      setFieldErrors((errors) => ({ ...errors, password: passwordError(value) }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (request.isWorking) {
      return;
    }

    const trimmedEmail = email.trim();
    const errors = { email: emailError(trimmedEmail), password: passwordError(password) };
    setFieldErrors(errors);
    setMessage(noMessage);

    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    const outcome = await request.run(async (signal): Promise<SignedInUser | SignInFailure> => {
      const result = await signInByEmail(trimmedEmail, password, signal);
      return result.ok ? finishSignIn(result.accessToken, signal) : result.failure;
    });

    if (outcome.kind === "failed") {
      setMessage({ text: failureMessages.unavailable, tone: "error" });
    } else if (outcome.kind === "done") {
      const userOrFailure = outcome.value;
      if (typeof userOrFailure === "string") {
        setMessage({ text: failureMessages[userOrFailure], tone: "error" });
      } else {
        setPassword("");
        onSignedIn(userOrFailure);
      }
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
            ref={emailRef}
            className={styles.input}
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => changeEmail(event.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          />
        </div>
        {fieldErrors.email && <FieldError id={emailErrorId} text={fieldErrors.email} />}
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`${id}-password`}>Password</label>
          <button
            type="button"
            className={styles.link}
            onClick={() => setMessage({ text: forgotPasswordMessage, tone: "info" })}
          >
            Forgot password?
          </button>
        </div>
        <div className={styles.inputWrap}>
          <span className={styles.leadingIcon}><LockIcon /></span>
          <input
            id={`${id}-password`}
            ref={passwordRef}
            className={`${styles.input} ${styles.inputWithButton}`}
            type={isPasswordShown ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => changePassword(event.target.value)}
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
        {fieldErrors.password && <FieldError id={passwordErrorId} text={fieldErrors.password} />}
      </div>

      <div className={styles.actions}>
        <PrimaryButton type="submit" disabled={request.isWorking}>
          {request.isWorking ? "Signing in…" : "Sign in"}
          {!request.isWorking && <span aria-hidden="true"> →</span>}
        </PrimaryButton>

        <StatusMessage message={message} />
      </div>
    </form>
  );
}

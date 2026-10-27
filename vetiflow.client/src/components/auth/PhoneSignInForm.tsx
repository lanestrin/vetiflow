import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { finishSignIn, startPhoneSignIn, verifyPhoneSignIn } from "../../services/authApi";
import type { SignedInUser } from "../../types/Auth";
import { PrimaryButton } from "./PrimaryButton";
import { LockIcon, PhoneIcon } from "./signInIcons";
import { failureMessages } from "./signInMessages";
import styles from "./SignInForm.module.scss";

interface PhoneSignInFormProps {
  onSignedIn: (user: SignedInUser) => void;
}

type Step = "number" | "code";

const readyMessage = "Demo verification is ready. No text was sent.";

// The same rule the API applies: a 10-digit US number, optionally with +1 and
// the usual separators. The API decides; this only gives a faster field error.
function looksLikeUsMobile(input: string): boolean {
  if (/[^0-9 ()+.-]/.test(input)) {
    return false;
  }

  const digits = input.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

// Demo phone sign-in (build plan S.19), from the login mockup. No text is ever
// sent: the demo code is fixed and shown on screen.
export function PhoneSignInForm({ onSignedIn }: PhoneSignInFormProps) {
  const id = useId();
  const codeRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("number");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState({ text: "", isReady: false });
  const [isWorking, setIsWorking] = useState(false);

  const phoneErrorId = `${id}-phone-error`;
  const codeErrorId = `${id}-code-error`;

  useEffect(() => {
    if (step === "code") {
      codeRef.current?.focus();
    }
  }, [step]);

  async function sendCode() {
    setIsWorking(true);
    const result = await startPhoneSignIn(phoneNumber.trim());
    setIsWorking(false);

    if (result.ok) {
      setStep("code");
      setMessage({ text: readyMessage, isReady: true });
    } else {
      setMessage({ text: failureMessages[result.failure], isReady: false });
    }
  }

  async function handleNumberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage({ text: "", isReady: false });

    if (!looksLikeUsMobile(phoneNumber.trim())) {
      setFieldError("Enter a 10-digit mobile number like 312-555-0101.");
      return;
    }

    setFieldError("");
    await sendCode();
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage({ text: "", isReady: false });

    if (!/^[0-9]{6}$/.test(code.trim())) {
      setFieldError("Enter the 6-digit code.");
      return;
    }

    setFieldError("");
    setIsWorking(true);
    const result = await verifyPhoneSignIn(phoneNumber.trim(), code.trim());

    if (!result.ok) {
      setIsWorking(false);
      setMessage({ text: failureMessages[result.failure], isReady: false });
      return;
    }

    try {
      onSignedIn(await finishSignIn(result.accessToken));
    } catch {
      setIsWorking(false);
      setMessage({ text: failureMessages.unavailable, isReady: false });
    }
  }

  function useDifferentNumber() {
    setStep("number");
    setCode("");
    setFieldError("");
    setMessage({ text: "", isReady: false });
  }

  const status = (
    <p
      className={message.isReady ? styles.messageReady : styles.message}
      role="status"
      aria-live="polite"
    >
      {message.text}
    </p>
  );

  if (step === "number") {
    return (
      <form className={styles.form} onSubmit={handleNumberSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-phone`}>Mobile phone number</label>
          <div className={styles.inputWrap}>
            <span className={styles.leadingIcon}><PhoneIcon /></span>
            <input
              id={`${id}-phone`}
              className={styles.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 555-0123"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? phoneErrorId : undefined}
            />
          </div>
          {fieldError && <p id={phoneErrorId} className={styles.fieldError}>{fieldError}</p>}
        </div>

        <PrimaryButton type="submit" disabled={isWorking}>
          {isWorking ? "Sending…" : "Text me a sign-in code"}
          {!isWorking && <span aria-hidden="true"> →</span>}
        </PrimaryButton>

        {status}
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleCodeSubmit} noValidate>
      <p className={styles.sentTo}>Code for {phoneNumber.trim()}</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-code`}>Verification code</label>
        <div className={styles.inputWrap}>
          <span className={styles.leadingIcon}><LockIcon /></span>
          <input
            id={`${id}-code`}
            ref={codeRef}
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${codeErrorId} ${id}-code-note` : `${id}-code-note`}
          />
        </div>
        {fieldError && <p id={codeErrorId} className={styles.fieldError}>{fieldError}</p>}
        <p id={`${id}-code-note`} className={styles.note}>
          Demo mode: no text is sent. Use code <strong>123456</strong>.
        </p>
      </div>

      <PrimaryButton type="submit" disabled={isWorking}>
        {isWorking ? "Signing in…" : "Verify and sign in"}
      </PrimaryButton>

      <div className={styles.secondaryActions}>
        <button type="button" className={styles.link} onClick={useDifferentNumber} disabled={isWorking}>
          Use a different number
        </button>
        <button type="button" className={styles.link} onClick={() => void sendCode()} disabled={isWorking}>
          Send again
        </button>
      </div>

      {status}
    </form>
  );
}

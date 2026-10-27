import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { finishSignIn, startPhoneSignIn, verifyPhoneSignIn } from "../../services/authApi";
import type { SignedInUser, SignInFailure } from "../../types/Auth";
import { FieldError, StatusMessage } from "./FormMessages";
import { PrimaryButton } from "./PrimaryButton";
import { LockIcon, PhoneIcon } from "./signInIcons";
import { failureMessages, noMessage, type FormMessage } from "./signInMessages";
import { useSignInRequest } from "./useSignInRequest";
import styles from "./SignInForm.module.scss";

interface PhoneSignInFormProps {
  onSignedIn: (user: SignedInUser) => void;
  // False while the Email tab is chosen: a running request is cancelled.
  isActive: boolean;
}

type Step = "number" | "code";

const readyMessage: FormMessage = { text: "Demo verification is ready. No text was sent.", tone: "success" };

// The same rule the API applies: a 10-digit US number, optionally with +1 and
// the usual separators. The API decides; this only gives a faster field error.
function looksLikeUsMobile(input: string): boolean {
  if (/[^0-9 ()+.-]/.test(input)) {
    return false;
  }

  const digits = input.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function phoneError(phoneNumber: string): string {
  return looksLikeUsMobile(phoneNumber.trim()) ? "" : "Enter a 10-digit mobile number like 312-555-0101.";
}

function codeError(code: string): string {
  return /^[0-9]{6}$/.test(code.trim()) ? "" : "Enter the 6-digit code.";
}

// Demo phone sign-in (build plan S.19), from the login mockup. No text is ever
// sent: the demo code is fixed and shown on screen.
export function PhoneSignInForm({ onSignedIn, isActive }: PhoneSignInFormProps) {
  const id = useId();
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("number");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  // One field shows at a time, so one error is enough.
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState<FormMessage>(noMessage);
  const request = useSignInRequest(isActive);

  const phoneErrorId = `${id}-phone-error`;
  const codeErrorId = `${id}-code-error`;

  useEffect(() => {
    if (step === "code") {
      codeRef.current?.focus();
    }
  }, [step]);

  // As in the email form: checked again as it is corrected, once it was wrong.
  function changePhoneNumber(value: string) {
    setPhoneNumber(value);
    if (fieldError) {
      setFieldError(phoneError(value));
    }
  }

  function changeCode(value: string) {
    setCode(value);
    if (fieldError) {
      setFieldError(codeError(value));
    }
  }

  async function sendCode() {
    setMessage(noMessage);
    const outcome = await request.run((signal) => startPhoneSignIn(phoneNumber.trim(), signal));

    if (outcome.kind === "failed") {
      setMessage({ text: failureMessages.unavailable, tone: "error" });
    } else if (outcome.kind === "done" && !outcome.value.ok) {
      setMessage({ text: failureMessages[outcome.value.failure], tone: "error" });
    } else if (outcome.kind === "done") {
      setStep("code");
      setMessage(readyMessage);
    }
  }

  async function handleNumberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (request.isWorking) {
      return;
    }

    const error = phoneError(phoneNumber);
    setFieldError(error);

    if (error) {
      setMessage(noMessage);
      phoneRef.current?.focus();
      return;
    }

    await sendCode();
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (request.isWorking) {
      return;
    }

    const error = codeError(code);
    setFieldError(error);
    setMessage(noMessage);

    if (error) {
      codeRef.current?.focus();
      return;
    }

    const outcome = await request.run(async (signal): Promise<SignedInUser | SignInFailure> => {
      const result = await verifyPhoneSignIn(phoneNumber.trim(), code.trim(), signal);
      return result.ok ? finishSignIn(result.accessToken, signal) : result.failure;
    });

    if (outcome.kind === "failed") {
      setMessage({ text: failureMessages.unavailable, tone: "error" });
    } else if (outcome.kind === "done") {
      const userOrFailure = outcome.value;
      if (typeof userOrFailure === "string") {
        setMessage({ text: failureMessages[userOrFailure], tone: "error" });
      } else {
        onSignedIn(userOrFailure);
      }
    }
  }

  // The number field comes back with the number still in it, and gets focus
  // (the button that was pressed has gone).
  function useDifferentNumber() {
    flushSync(() => {
      setStep("number");
      setCode("");
      setFieldError("");
      setMessage(noMessage);
    });
    phoneRef.current?.focus();
  }

  if (step === "number") {
    return (
      <form className={styles.form} onSubmit={handleNumberSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-phone`}>Mobile phone number</label>
          <div className={styles.inputWrap}>
            <span className={styles.leadingIcon}><PhoneIcon /></span>
            <input
              id={`${id}-phone`}
              ref={phoneRef}
              className={styles.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 555-0123"
              value={phoneNumber}
              onChange={(event) => changePhoneNumber(event.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${phoneErrorId} ${id}-phone-note` : `${id}-phone-note`}
            />
          </div>
          {fieldError && <FieldError id={phoneErrorId} text={fieldError} />}
          <p id={`${id}-phone-note`} className={styles.note}>
            Demo mode: no text is sent. The next step shows the code to use.
          </p>
        </div>

        <div className={styles.actions}>
          <PrimaryButton type="submit" disabled={request.isWorking}>
            {request.isWorking ? "Sending…" : "Text me a sign-in code"}
            {!request.isWorking && <span aria-hidden="true"> →</span>}
          </PrimaryButton>

          <StatusMessage message={message} />
        </div>
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
            onChange={(event) => changeCode(event.target.value)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${codeErrorId} ${id}-code-note` : `${id}-code-note`}
          />
        </div>
        {fieldError && <FieldError id={codeErrorId} text={fieldError} />}
        <p id={`${id}-code-note`} className={styles.note}>
          Demo mode: no text is sent. Use code <strong>123456</strong>.
        </p>
      </div>

      <div className={styles.actions}>
        <PrimaryButton type="submit" disabled={request.isWorking}>
          {request.isWorking ? "Signing in…" : "Verify and sign in"}
        </PrimaryButton>

        <div className={styles.secondaryActions}>
          <button type="button" className={styles.link} onClick={useDifferentNumber} disabled={request.isWorking}>
            Use a different number
          </button>
          <button type="button" className={styles.link} onClick={() => void sendCode()} disabled={request.isWorking}>
            Send again
          </button>
        </div>

        <StatusMessage message={message} />
      </div>
    </form>
  );
}

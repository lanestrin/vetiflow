import { useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { finishSignIn, verifyPhoneSignIn } from "../../services/authApi";
import type { SignedInUser, SignInFailure } from "../../types/Auth";
import { FieldError, StatusMessage } from "./FormMessages";
import { PrimaryButton } from "./PrimaryButton";
import { LockIcon, PhoneIcon } from "./signInIcons";
import { failureMessages, noMessage, type FormMessage } from "./signInMessages";
import { delay, useSignInRequest } from "./useSignInRequest";
import styles from "./SignInForm.module.scss";

interface PhoneSignInFormProps {
  onSignedIn: (user: SignedInUser) => void;
  // False while the Email tab is chosen: a running request is cancelled.
  isActive: boolean;
}

// The fixed demo code, also shown under the code field. The API checks it
// too; checking here only spares a request.
const demoCode = "123456";

// How long the simulated text and code check take, so each step reads as
// something happening.
const sendMs = 800;
const checkMs = 600;

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
// sent: sending is simulated in the browser, and the code field waits, off,
// until then. Only the right demo code reaches the API, for the token.
export function PhoneSignInForm({ onSignedIn, isActive }: PhoneSignInFormProps) {
  const id = useId();
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  // What the button says while a step runs.
  const [working, setWorking] = useState<"sending" | "verifying">("sending");
  const [phoneFieldError, setPhoneFieldError] = useState("");
  const [codeFieldError, setCodeFieldError] = useState("");
  const [message, setMessage] = useState<FormMessage>(noMessage);
  const request = useSignInRequest(isActive);

  const phoneErrorId = `${id}-phone-error`;
  const codeErrorId = `${id}-code-error`;

  // A new number needs a new code, so the code field goes back off.
  function changePhoneNumber(value: string) {
    setPhoneNumber(value);
    if (phoneFieldError) {
      setPhoneFieldError(phoneError(value));
    }
    if (codeSent) {
      setCodeSent(false);
      setCode("");
      setCodeFieldError("");
      setMessage(noMessage);
    }
  }

  // As in the email form: checked again as it is corrected, once it was wrong.
  function changeCode(value: string) {
    setCode(value);
    if (codeFieldError) {
      setCodeFieldError(codeError(value));
    }
  }

  async function sendCode() {
    setWorking("sending");
    setMessage(noMessage);
    const outcome = await request.run((signal) => delay(sendMs, signal));

    if (outcome.kind === "done") {
      // The field must be on before it can take focus.
      flushSync(() => {
        setCodeSent(true);
        setMessage(readyMessage);
      });
      codeRef.current?.focus();
    }
  }

  async function verifyCode() {
    setWorking("verifying");
    setMessage(noMessage);
    const outcome = await request.run(async (signal): Promise<SignedInUser | SignInFailure> => {
      await delay(checkMs, signal);

      if (code.trim() !== demoCode) {
        return "wrongCode";
      }

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (request.isWorking) {
      return;
    }

    if (!codeSent) {
      const error = phoneError(phoneNumber);
      setPhoneFieldError(error);

      if (error) {
        setMessage(noMessage);
        phoneRef.current?.focus();
        return;
      }

      await sendCode();
      return;
    }

    const error = codeError(code);
    setCodeFieldError(error);

    if (error) {
      setMessage(noMessage);
      codeRef.current?.focus();
      return;
    }

    await verifyCode();
  }

  function buttonText() {
    if (request.isWorking) {
      return working === "sending" ? "Sending…" : "Signing in…";
    }

    return codeSent ? "Verify and sign in" : "Text me a sign-in code";
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
            aria-invalid={phoneFieldError ? true : undefined}
            aria-describedby={phoneFieldError ? `${phoneErrorId} ${id}-phone-note` : `${id}-phone-note`}
          />
        </div>
        {phoneFieldError && <FieldError id={phoneErrorId} text={phoneFieldError} />}
        <p id={`${id}-phone-note`} className={styles.note}>
          Demo mode: no text is sent. The next step shows the code to use.
        </p>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`${id}-code`}>Verification code</label>
          {codeSent && (
            <button type="button" className={styles.link} onClick={() => void sendCode()} disabled={request.isWorking}>
              Send again
            </button>
          )}
        </div>
        <div className={styles.inputWrap}>
          <span className={styles.leadingIcon}><LockIcon /></span>
          <input
            id={`${id}-code`}
            ref={codeRef}
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={codeSent ? "6-digit code" : "Send a code first"}
            maxLength={6}
            disabled={!codeSent}
            value={code}
            onChange={(event) => changeCode(event.target.value)}
            aria-invalid={codeFieldError ? true : undefined}
            aria-describedby={codeFieldError ? `${codeErrorId} ${id}-code-note` : `${id}-code-note`}
          />
        </div>
        {codeFieldError && <FieldError id={codeErrorId} text={codeFieldError} />}
        <p id={`${id}-code-note`} className={styles.note}>
          Demo mode: no text is sent. Use code <strong>{demoCode}</strong>.
        </p>
      </div>

      <div className={styles.actions}>
        <PrimaryButton type="submit" disabled={request.isWorking}>
          {buttonText()}
          {!request.isWorking && !codeSent && <span aria-hidden="true"> →</span>}
        </PrimaryButton>

        <StatusMessage message={message} />
      </div>
    </form>
  );
}

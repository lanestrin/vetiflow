import { AlertIcon, CheckIcon } from "./signInIcons";
import type { FormMessage } from "./signInMessages";
import styles from "./SignInForm.module.scss";

// Each tone has its own colour and, for errors and good news, an icon, so
// none relies on colour alone.
const toneClasses: Record<FormMessage["tone"], string> = {
  error: styles.messageError,
  info: styles.messageInfo,
  success: styles.messageSuccess
};

// The form's polite live region. It is always rendered, so screen readers
// announce each new message. Empty, it has no children, so the CSS :empty
// can tell.
export function StatusMessage({ message }: { message: FormMessage }) {
  return (
    <p className={`${styles.message} ${toneClasses[message.tone]}`} role="status" aria-live="polite">
      {message.text === "" ? null : (
        <>
          {message.tone === "error" && <AlertIcon />}
          {message.tone === "success" && <CheckIcon />}
          {message.text}
        </>
      )}
    </p>
  );
}

// A field's error, linked to it through aria-describedby.
export function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className={styles.fieldError}>
      <AlertIcon />
      {text}
    </p>
  );
}

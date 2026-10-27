import type { ButtonHTMLAttributes } from "react";
import styles from "./PrimaryButton.module.scss";

// The full-width teal action on the sign-in screens.
export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={styles.primary} />;
}

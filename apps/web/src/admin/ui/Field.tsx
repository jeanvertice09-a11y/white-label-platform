import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import styles from "./Field.module.css";
function Wrap({
  label,
  hint,
  children,
}: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
export function Input({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <Wrap label={label} hint={hint}>
      <input className={styles.control} {...props} />
    </Wrap>
  );
}
export function Select({
  label,
  hint,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <Wrap label={label} hint={hint}>
      <select className={styles.control} {...props}>
        {children}
      </select>
    </Wrap>
  );
}
export function Textarea({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <Wrap label={label} hint={hint}>
      <textarea className={`${styles.control} ${styles.textarea}`} {...props} />
    </Wrap>
  );
}

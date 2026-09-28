import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Tone = "default" | "primary" | "danger";
export function Button({ tone = "default", children, className = "", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; children: ReactNode }) {
  const toneClass = tone === "primary" ? styles.primary : tone === "danger" ? styles.danger : "";
  return <button className={`${styles.button} ${toneClass} ${className}`} {...props}>{children}</button>;
}

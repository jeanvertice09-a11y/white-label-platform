import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";
export function EmptyState({
  title,
  description,
  action,
}: Readonly<{ title: string; description: string; action?: ReactNode }>) {
  return (
    <div className={styles.empty}>
      <div className={styles.copy}>
        <strong>{title}</strong>
        <p>{description}</p>
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </div>
  );
}

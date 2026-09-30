import styles from "./StatusDot.module.css";
export function StatusDot({
  label,
  tone = "default",
}: Readonly<{
  label: string;
  tone?: "default" | "ok" | "warning" | "danger";
}>) {
  return (
    <span className={`${styles.status} ${tone === "default" ? "" : styles[tone]}`}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}

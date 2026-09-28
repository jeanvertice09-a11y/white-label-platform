import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";
export function Skeleton({ width = "100%", height = 16 }: Readonly<{ width?: string | number; height?: number }>) {
  return <span className={styles.skeleton} style={{ width, height } as CSSProperties} aria-hidden="true" />;
}

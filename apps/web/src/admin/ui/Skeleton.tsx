import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";
export function Skeleton({ width = "100%", height = 16 }: Readonly<{ width?: string | number; height?: number }>) {
  const style: CSSProperties = { width, height };
  return <span className={styles.skeleton} style={style} aria-hidden="true" />;
}

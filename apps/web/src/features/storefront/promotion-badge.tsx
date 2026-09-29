import type { CSSProperties } from "react";

const style: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  borderRadius: "999px",
  padding: ".25rem .55rem",
  fontSize: ".72rem",
  fontWeight: 800,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  background: "var(--sf-accent)",
  color: "#111",
};

export function PromotionBadge(): React.JSX.Element {
  return <span style={style}>Oferta</span>;
}

import { useEffect, useState } from "react";
import type { PublicCatalogMerchandising } from "@white-label/catalog";

const CSS = `.sf-promo{background:var(--sf-primary);color:#fff;padding:.7rem 1rem;text-align:center;font:600 .9rem/1.35 var(--sf-font);display:flex;gap:.75rem;justify-content:center;align-items:center;flex-wrap:wrap}.sf-promo>*{min-width:0;max-width:100%;overflow-wrap:anywhere}.sf-promo a{color:inherit;text-decoration:underline;text-underline-offset:3px}.sf-promo__count{font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.92}@media(max-width:640px){.sf-promo{padding:.65rem .8rem;font-size:.82rem;gap:.4rem}.sf-promo__count{width:100%}}`;

function remainingLabel(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days > 0 ? `${String(days)}d ${clock}` : clock;
}

export function PromotionalBar({ merchandising }: Readonly<{ merchandising?: PublicCatalogMerchandising | null }>): React.JSX.Element | null {
  const endMs = merchandising?.endsAt ? Date.parse(merchandising.endsAt) : null;
  const serverMs = merchandising ? Date.parse(merchandising.serverNow) : 0;
  const initialRemaining = endMs === null ? null : Math.max(0, endMs - serverMs);
  const [remaining, setRemaining] = useState<number | null>(initialRemaining);
  useEffect(() => {
    if (initialRemaining === null) return;
    const startedAt = Date.now();
    const update = () => { setRemaining(Math.max(0, initialRemaining - (Date.now() - startedAt))); };
    const timer = window.setInterval(update, 1000); update();
    return () => { window.clearInterval(timer); };
  }, [initialRemaining]);
  if (!merchandising || remaining === 0) return null;
  const copy = merchandising.href ? <a href={merchandising.href}>{merchandising.text}</a> : <span>{merchandising.text}</span>;
  return <><style>{CSS}</style><aside className="sf-promo" aria-label="Promoção">{copy}{merchandising.countdown && remaining !== null ? <strong className="sf-promo__count" aria-label="Tempo restante">{remainingLabel(remaining)}</strong> : null}</aside></>;
}

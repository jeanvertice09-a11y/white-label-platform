import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Coupon, CouponMutationInput } from "@white-label/marketing";
import { centsToInput, moneyToCents } from "./format.ts";
import {
  createMerchantCoupon,
  updateMerchantCoupon,
} from "../../lib/server/operations-marketing.functions.ts";

function toIso(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? new Date(text).toISOString() : null;
}

function readCoupon(form: FormData): CouponMutationInput {
  const type = String(form.get("discountType")) === "fixed" ? "fixed" : "percentage";
  const rawValue = String(form.get("discountValue") ?? "0");
  const minimum = String(form.get("minimumOrder") ?? "").trim();
  const limit = String(form.get("usageLimit") ?? "").trim();
  return {
    code: String(form.get("code") ?? ""),
    name: String(form.get("name") ?? ""),
    active: form.get("active") === "on",
    discountType: type,
    discountValue: type === "percentage" ? Number(rawValue) : moneyToCents(rawValue),
    minimumOrderCents: minimum ? moneyToCents(minimum) : null,
    startsAt: toIso(form.get("startsAt")),
    endsAt: toIso(form.get("endsAt")),
    usageLimit: limit ? Number(limit) : null,
  };
}

function CouponFields({ coupon }: Readonly<{ coupon?: Coupon }>): React.JSX.Element {
  const percentage = coupon?.discountType !== "fixed";
  return (
    <div className="k-form__grid">
      <div className="k-field"><label>Código</label><input name="code" defaultValue={coupon?.code ?? ""} required /></div>
      <div className="k-field"><label>Nome</label><input name="name" defaultValue={coupon?.name ?? ""} required /></div>
      <div className="k-field"><label>Tipo</label><select name="discountType" defaultValue={coupon?.discountType ?? "percentage"}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></div>
      <div className="k-field"><label>Valor</label><input name="discountValue" defaultValue={coupon ? (percentage ? String(coupon.discountValue) : centsToInput(coupon.discountValue)) : ""} required /></div>
      <div className="k-field"><label>Pedido mínimo (R$)</label><input name="minimumOrder" defaultValue={centsToInput(coupon?.minimumOrderCents ?? null)} /></div>
      <div className="k-field"><label>Limite de usos</label><input name="usageLimit" type="number" min={1} defaultValue={coupon?.usageLimit ?? ""} /></div>
      <div className="k-field"><label>Início</label><input name="startsAt" type="datetime-local" defaultValue={coupon?.startsAt?.slice(0, 16) ?? ""} /></div>
      <div className="k-field"><label>Fim</label><input name="endsAt" type="datetime-local" defaultValue={coupon?.endsAt?.slice(0, 16) ?? ""} /></div>
      <label className="k-check"><input name="active" type="checkbox" defaultChecked={coupon?.active ?? true} />Ativo</label>
    </div>
  );
}

export function CouponManager({ coupons }: Readonly<{ coupons: Coupon[] }>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>, id?: string): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const input = readCoupon(new FormData(event.currentTarget));
      if (id) await updateMerchantCoupon({ data: { id, input } });
      else await createMerchantCoupon({ data: input });
      if (!id) event.currentTarget.reset();
      setMessage(id ? "Cupom atualizado." : "Cupom criado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o cupom.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="k-stack">
      <form className="k-card k-form" onSubmit={(event) => { void save(event); }}>
        <h2>Novo cupom</h2>
        <CouponFields />
        <div className="k-actions"><button className="k-button k-button--primary" disabled={busy} type="submit">Criar cupom</button></div>
      </form>
      {message ? <div className="k-status">{message}</div> : null}
      {coupons.map((coupon) => (
        <details className="k-card" key={coupon.id}>
          <summary><strong>{coupon.code}</strong> — {coupon.name} · {coupon.usageCount}{coupon.usageLimit ? "/" + String(coupon.usageLimit) : ""} usos</summary>
          <form className="k-form" onSubmit={(event) => { void save(event, coupon.id); }}>
            <CouponFields coupon={coupon} />
            <div className="k-actions"><button className="k-button" disabled={busy} type="submit">Salvar cupom</button></div>
          </form>
        </details>
      ))}
    </div>
  );
}

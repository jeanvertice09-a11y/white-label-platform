import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Coupon, CouponMutationInput } from "@white-label/marketing";
import { centsToInput, moneyToCents } from "./format.ts";
import {
  createMerchantCoupon,
  updateMerchantCoupon,
} from "../../lib/server/operations-marketing.functions.ts";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function toIso(value: string): string | null {
  const text = value.trim();
  return text ? new Date(text).toISOString() : null;
}

function readCoupon(form: FormData): CouponMutationInput {
  const type = field(form, "discountType") === "fixed" ? "fixed" : "percentage";
  const rawValue = field(form, "discountValue");
  const minimum = field(form, "minimumOrder").trim();
  const limit = field(form, "usageLimit").trim();
  return {
    code: field(form, "code"),
    name: field(form, "name"),
    active: form.get("active") === "on",
    discountType: type,
    discountValue: type === "percentage" ? Number(rawValue) : moneyToCents(rawValue),
    minimumOrderCents: minimum ? moneyToCents(minimum) : null,
    startsAt: toIso(field(form, "startsAt")),
    endsAt: toIso(field(form, "endsAt")),
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

function matches(coupon: Coupon, rawSearch: string): boolean {
  const search = rawSearch.trim().toLocaleLowerCase("pt-BR");
  if (!search) return true;
  return coupon.code.toLocaleLowerCase("pt-BR").includes(search)
    || coupon.name.toLocaleLowerCase("pt-BR").includes(search);
}

function CouponEditor(props: Readonly<{
  coupon: Coupon;
  busy: boolean;
  save: (event: React.SyntheticEvent<HTMLFormElement>, id?: string) => Promise<void>;
}>): React.JSX.Element {
  const { coupon, busy, save } = props;
  return (
    <details className="k-record-editor">
      <summary>
        <span className="k-record-editor__identity">
          <strong>{coupon.code}</strong>
          <small>{coupon.name} · {coupon.usageCount}{coupon.usageLimit ? `/${String(coupon.usageLimit)}` : ""} usos</small>
        </span>
        <span className={coupon.active ? "k-status-pill k-status-pill--active" : "k-status-pill"}>
          {coupon.active ? "Ativo" : "Inativo"}
        </span>
      </summary>
      <form className="k-record-editor__form" onSubmit={(event) => { void save(event, coupon.id); }}>
        <CouponFields coupon={coupon} />
        <div className="k-record-editor__footer">
          <button className="k-button" disabled={busy} type="submit">Salvar cupom</button>
        </div>
      </form>
    </details>
  );
}

export function CouponManager({ coupons }: Readonly<{
  coupons: Coupon[];
}>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const visible = useMemo(
    () => coupons.filter((coupon) => matches(coupon, search)),
    [coupons, search],
  );

  async function save(
    event: React.SyntheticEvent<HTMLFormElement>,
    id?: string,
  ): Promise<void> {
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
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">Promoções</span>
          <h2>Cupons</h2>
          <p>Regras promocionais da loja com consulta e edição em uma lista compacta.</p>
        </div>
        <span className="k-section-count">{coupons.length} cupom(ns)</span>
      </header>

      <details className="k-composer">
        <summary>
          <span><strong>Novo cupom</strong><small>Defina código, desconto, vigência e limites.</small></span>
          <span className="k-composer__action">Criar</span>
        </summary>
        <form className="k-composer__body" onSubmit={(event) => { void save(event); }}>
          <CouponFields />
          <div className="k-actions">
            <button className="k-button k-button--primary" disabled={busy} type="submit">Criar cupom</button>
          </div>
        </form>
      </details>

      <div className="k-toolbar">
        <div className="k-toolbar__search">
          <label className="k-visually-hidden" htmlFor="coupon-search">Pesquisar cupons</label>
          <input id="coupon-search" value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Código ou nome" />
        </div>
        {search ? <button className="k-button k-button--ghost" type="button" onClick={() => { setSearch(""); }}>Limpar</button> : null}
      </div>

      {message ? <div className="k-inline-state">{message}</div> : null}
      {visible.length === 0 ? (
        <div className="k-inline-state">
          <strong>Nenhum cupom encontrado</strong>
          <span>Crie um cupom ou ajuste a busca.</span>
        </div>
      ) : (
        <div className="k-record-list">
          {visible.map((coupon) => (
            <CouponEditor key={coupon.id} coupon={coupon} busy={busy} save={save} />
          ))}
        </div>
      )}
    </section>
  );
}

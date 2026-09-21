import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { Page, Supplier, SupplierInput } from "../../../../../packages/merchant-ops/src/types.ts";
import {
  createMerchantSupplier,
  listMerchantSuppliers,
  setMerchantSupplierStatus,
  updateMerchantSupplier,
} from "../../lib/server/operations-merchant.functions.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { messageFrom } from "./merchant-operations-utils.ts";

const PAGE_SIZE = 25;
type SupplierForm = Record<"name" | "tradeName" | "document" | "contactName" | "phone" | "whatsapp" | "email" | "address" | "notes", string>;
const EMPTY: SupplierForm = { name: "", tradeName: "", document: "", contactName: "", phone: "", whatsapp: "", email: "", address: "", notes: "" };

function fromSupplier(item: Supplier): SupplierForm {
  return {
    name: item.name, tradeName: item.tradeName ?? "", document: item.document ?? "", contactName: item.contactName ?? "",
    phone: item.phone ?? "", whatsapp: item.whatsapp ?? "", email: item.email ?? "", address: item.address ?? "", notes: item.notes ?? "",
  };
}

function payload(form: SupplierForm): SupplierInput {
  return {
    name: form.name,
    tradeName: form.tradeName.trim() || null,
    document: form.document.trim() || null,
    contactName: form.contactName.trim() || null,
    phone: form.phone.trim() || null,
    whatsapp: form.whatsapp.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
  };
}

function SupplierFormCard(props: Readonly<{
  form: SupplierForm;
  setForm: (value: SupplierForm) => void;
  editing: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}>): React.JSX.Element {
  const field = (key: keyof SupplierForm, label: string, maxLength: number, type = "text") => (
    <label className="k-field"><span>{label}</span><input type={type} maxLength={maxLength} value={props.form[key]} onChange={(e) => { props.setForm({ ...props.form, [key]: e.target.value }); }} /></label>
  );
  return <section className="k-card">
    <div className="k-row"><div><h2>{props.editing ? "Editar fornecedor" : "Novo fornecedor"}</h2><p className="k-muted">Dados usados em compras e contas da loja.</p></div>{props.editing ? <button className="k-button" type="button" disabled={props.loading} onClick={props.onCancel}>Cancelar edição</button> : null}</div>
    <form className="k-form" onSubmit={props.onSubmit}>
      <div className="k-form__grid">
        <label className="k-field"><span>Nome / razão social</span><input required maxLength={180} value={props.form.name} onChange={(e) => { props.setForm({ ...props.form, name: e.target.value }); }} /></label>
        {field("tradeName", "Nome fantasia", 180)}{field("document", "Documento", 40)}{field("contactName", "Contato", 180)}
        {field("phone", "Telefone", 40)}{field("whatsapp", "WhatsApp", 40)}{field("email", "E-mail", 254, "email")}{field("address", "Endereço", 600)}
        <label className="k-field k-field--full"><span>Observações</span><textarea maxLength={2000} value={props.form.notes} onChange={(e) => { props.setForm({ ...props.form, notes: e.target.value }); }} /></label>
      </div>
      <div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={props.loading}>{props.loading ? "Salvando…" : props.editing ? "Salvar alterações" : "Salvar fornecedor"}</button></div>
    </form>
  </section>;
}

function SupplierTable(props: Readonly<{
  data: Page<Supplier>;
  loading: boolean;
  onEdit: (item: Supplier) => void;
  onToggle: (item: Supplier) => Promise<void>;
}>): React.JSX.Element {
  if (!props.data.items.length) return <div className="k-empty"><strong>Nenhum fornecedor</strong><span>Cadastre o primeiro fornecedor ou ajuste a busca.</span></div>;
  return <div className="k-table-wrap k-table-wrap--flush"><table className="k-table">
    <thead><tr><th>Fornecedor</th><th>Contato</th><th>Documento</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>{props.data.items.map((item) => <tr key={item.id}>
      <td><strong>{item.name}</strong><div className="k-row__meta">{item.tradeName ?? item.email ?? "Sem nome fantasia"}</div></td>
      <td>{item.contactName ?? "—"}<div className="k-row__meta">{item.whatsapp ?? item.phone ?? ""}</div></td>
      <td>{item.document ?? "—"}</td>
      <td><span className={item.status === "active" ? "k-badge k-badge--on" : "k-badge"}>{item.status === "active" ? "Ativo" : "Arquivado"}</span></td>
      <td><div className="k-actions"><button className="k-button" type="button" disabled={props.loading} onClick={() => { props.onEdit(item); }}>Editar</button><button className="k-button" type="button" disabled={props.loading} onClick={() => { void props.onToggle(item); }}>{item.status === "active" ? "Arquivar" : "Reativar"}</button></div></td>
    </tr>)}</tbody>
  </table></div>;
}

export function MerchantSuppliersManager({ initial }: Readonly<{ initial: Page<Supplier> }>): React.JSX.Element {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY);

  async function load(page = 1, clear = false): Promise<void> {
    setLoading(true); setError("");
    try {
      const nextSearch = clear ? "" : search.trim();
      if (clear) setSearch("");
      setData(await listMerchantSuppliers({ data: { page, pageSize: PAGE_SIZE, search: nextSearch || undefined } }));
    } catch (cause) { setError(messageFrom(cause, "Não foi possível carregar os fornecedores.")); }
    finally { setLoading(false); }
  }

  function edit(item: Supplier): void { setEditingId(item.id); setForm(fromSupplier(item)); setError(""); setSuccess(""); }
  function reset(): void { setEditingId(null); setForm(EMPTY); }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      if (editingId) await updateMerchantSupplier({ data: { supplierId: editingId, input: payload(form) } });
      else await createMerchantSupplier({ data: payload(form) });
      setSuccess(editingId ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      reset(); await load(1);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível salvar o fornecedor.")); }
    finally { setLoading(false); }
  }

  async function toggle(item: Supplier): Promise<void> {
    if (item.status === "active" && !confirmDangerousAction("Arquivar este fornecedor? O histórico de compras e financeiro será preservado.")) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      await setMerchantSupplierStatus({ data: { supplierId: item.id, status: item.status === "active" ? "inactive" : "active" } });
      setSuccess(item.status === "active" ? "Fornecedor arquivado sem apagar o histórico." : "Fornecedor reativado.");
      if (editingId === item.id) reset();
      await load(data.page);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível alterar o fornecedor.")); }
    finally { setLoading(false); }
  }

  return <div className="k-stack">
    <SupplierFormCard form={form} setForm={setForm} editing={Boolean(editingId)} loading={loading} onCancel={reset} onSubmit={(event) => { void submit(event); }} />
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Fornecedores</h2><p>{data.total} fornecedor(es) cadastrados. Arquivar preserva vínculos históricos.</p></div></div>
      <form className="k-toolbar" onSubmit={(event) => { event.preventDefault(); void load(1); }}><label className="k-toolbar__search"><span className="k-visually-hidden">Buscar fornecedor</span><input value={search} onChange={(e) => { setSearch(e.target.value); }} placeholder="Nome, documento ou e-mail…" /></label><button className="k-button k-button--primary" type="submit" disabled={loading}>Buscar</button>{search ? <button className="k-button" type="button" disabled={loading} onClick={() => { void load(1, true); }}>Limpar</button> : null}</form>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
      {success ? <div className="k-inline-state"><strong>Concluído</strong><span>{success}</span></div> : null}
      <SupplierTable data={data} loading={loading} onEdit={edit} onToggle={toggle} />
      {data.total > PAGE_SIZE ? <div className="k-pagination"><span>Página {data.page} · {data.total} registros</span><div><button className="k-button" type="button" disabled={loading || data.page <= 1} onClick={() => { void load(data.page - 1); }}>Anterior</button><button className="k-button" type="button" disabled={loading || data.page * data.pageSize >= data.total} onClick={() => { void load(data.page + 1); }}>Próxima</button></div></div> : null}
    </section>
  </div>;
}

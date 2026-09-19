import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { Page, Supplier } from "../../../../../packages/merchant-ops/src/types.ts";
import {
  createMerchantSupplier,
  listMerchantSuppliers,
  setMerchantSupplierStatus,
} from "../../lib/server/operations-merchant.functions.ts";
import { messageFrom } from "./merchant-operations-utils.ts";

const PAGE_SIZE = 25;

interface SupplierFormState {
  name: string;
  tradeName: string;
  document: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  notes: string;
}

const EMPTY_SUPPLIER_FORM: SupplierFormState = { name: "", tradeName: "", document: "", contactName: "", phone: "", whatsapp: "", email: "", address: "", notes: "" };

function NewSupplierForm({ form, setForm, loading, onSubmit }: Readonly<{
  form: SupplierFormState;
  setForm: (value: SupplierFormState) => void;
  loading: boolean;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}>): React.JSX.Element {
  return (
    <section className="k-card">
      <div className="k-row"><div><h2>Novo fornecedor</h2><p className="k-muted">Cadastre contatos usados em compras e contas a pagar.</p></div></div>
      <form className="k-form" onSubmit={onSubmit}>
        <div className="k-form__grid">
          <label className="k-field"><span>Nome / razão social</span><input required maxLength={180} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); }} /></label>
          <label className="k-field"><span>Nome fantasia</span><input maxLength={180} value={form.tradeName} onChange={(e) => { setForm({ ...form, tradeName: e.target.value }); }} /></label>
          <label className="k-field"><span>Documento</span><input maxLength={40} value={form.document} onChange={(e) => { setForm({ ...form, document: e.target.value }); }} /></label>
          <label className="k-field"><span>Contato</span><input maxLength={180} value={form.contactName} onChange={(e) => { setForm({ ...form, contactName: e.target.value }); }} /></label>
          <label className="k-field"><span>Telefone</span><input maxLength={40} value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); }} /></label>
          <label className="k-field"><span>WhatsApp</span><input maxLength={40} value={form.whatsapp} onChange={(e) => { setForm({ ...form, whatsapp: e.target.value }); }} /></label>
          <label className="k-field"><span>E-mail</span><input type="email" maxLength={254} value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); }} /></label>
          <label className="k-field"><span>Endereço</span><input maxLength={600} value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); }} /></label>
          <label className="k-field k-field--full"><span>Observações</span><textarea maxLength={2000} value={form.notes} onChange={(e) => { setForm({ ...form, notes: e.target.value }); }} /></label>
        </div>
        <div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={loading}>Salvar fornecedor</button></div>
      </form>
    </section>
  );
}

function SupplierToolbar({ search, setSearch, loading, onSearch, onClear }: Readonly<{
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  onSearch: (event: SyntheticEvent<HTMLFormElement>) => void;
  onClear: () => void;
}>): React.JSX.Element {
  return (
    <form className="k-toolbar" onSubmit={onSearch}>
      <label className="k-toolbar__search"><span className="k-visually-hidden">Buscar fornecedor</span><input value={search} onChange={(e) => { setSearch(e.target.value); }} placeholder="Nome, documento ou e-mail…" /></label>
      <button className="k-button k-button--primary" type="submit" disabled={loading}>Buscar</button>
      {search ? <button className="k-button" type="button" disabled={loading} onClick={onClear}>Limpar</button> : null}
    </form>
  );
}

function SupplierTable({ data, loading, onToggle }: Readonly<{ data: Page<Supplier>; loading: boolean; onToggle: (item: Supplier) => void }>): React.JSX.Element | null {
  if (data.items.length === 0) {
    return !loading ? <div className="k-empty"><strong>Nenhum fornecedor</strong><span>Cadastre o primeiro fornecedor ou ajuste a busca.</span></div> : null;
  }
  return (
    <div className="k-table-wrap k-table-wrap--flush">
      <table className="k-table">
        <thead><tr><th>Fornecedor</th><th>Contato</th><th>Documento</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>{data.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><div className="k-row__meta">{item.tradeName ?? item.email ?? "Sem nome fantasia"}</div></td><td>{item.contactName ?? "—"}<div className="k-row__meta">{item.whatsapp ?? item.phone ?? ""}</div></td><td>{item.document ?? "—"}</td><td><span className={item.status === "active" ? "k-badge k-badge--on" : "k-badge"}>{item.status === "active" ? "Ativo" : "Inativo"}</span></td><td><button className="k-button" type="button" disabled={loading} onClick={() => { onToggle(item); }}>{item.status === "active" ? "Inativar" : "Reativar"}</button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function SupplierPagination({ data, loading, onPage }: Readonly<{ data: Page<Supplier>; loading: boolean; onPage: (page: number) => void }>): React.JSX.Element | null {
  if (data.total <= PAGE_SIZE) return null;
  return (
    <div className="k-pagination">
      <span>Página {data.page} · {data.total} registros</span>
      <div>
        <button className="k-button" type="button" disabled={loading || data.page <= 1} onClick={() => { onPage(data.page - 1); }}>Anterior</button>
        <button className="k-button" type="button" disabled={loading || data.page * data.pageSize >= data.total} onClick={() => { onPage(data.page + 1); }}>Próxima</button>
      </div>
    </div>
  );
}

function SupplierListSection({ data, search, setSearch, loading, error, success, onSearch, onClear, onPage, onToggle }: Readonly<{
  data: Page<Supplier>;
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSearch: (event: SyntheticEvent<HTMLFormElement>) => void;
  onClear: () => void;
  onPage: (page: number) => void;
  onToggle: (item: Supplier) => void;
}>): React.JSX.Element {
  return (
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Fornecedores</h2><p>{data.total} fornecedor(es) cadastrados.</p></div></div>
      <SupplierToolbar search={search} setSearch={setSearch} loading={loading} onSearch={onSearch} onClear={onClear} />
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
      {success ? <div className="k-inline-state"><strong>Concluído</strong><span>{success}</span></div> : null}
      <SupplierTable data={data} loading={loading} onToggle={onToggle} />
      <SupplierPagination data={data} loading={loading} onPage={onPage} />
    </section>
  );
}

export function MerchantSuppliersManager({ initial }: Readonly<{ initial: Page<Supplier> }>): React.JSX.Element {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<SupplierFormState>(EMPTY_SUPPLIER_FORM);

  async function load(page = 1, clear = false): Promise<void> {
    setLoading(true); setError("");
    try {
      const nextSearch = clear ? "" : search.trim();
      if (clear) setSearch("");
      setData(await listMerchantSuppliers({ data: { page, pageSize: PAGE_SIZE, search: nextSearch || undefined } }));
    } catch (cause) { setError(messageFrom(cause, "Não foi possível carregar os fornecedores.")); }
    finally { setLoading(false); }
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      await createMerchantSupplier({ data: {
        name: form.name,
        tradeName: form.tradeName.trim() || null,
        document: form.document.trim() || null,
        contactName: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      } });
      setForm(EMPTY_SUPPLIER_FORM);
      setSuccess("Fornecedor cadastrado.");
      await load(1);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível cadastrar o fornecedor.")); }
    finally { setLoading(false); }
  }

  async function toggle(item: Supplier): Promise<void> {
    setLoading(true); setError(""); setSuccess("");
    try {
      await setMerchantSupplierStatus({ data: { supplierId: item.id, status: item.status === "active" ? "inactive" : "active" } });
      setSuccess(item.status === "active" ? "Fornecedor inativado." : "Fornecedor reativado.");
      await load(data.page);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível alterar o fornecedor.")); }
    finally { setLoading(false); }
  }

  return (
    <div className="k-stack">
      <NewSupplierForm form={form} setForm={setForm} loading={loading} onSubmit={(event) => { void submit(event); }} />
      <SupplierListSection data={data} search={search} setSearch={setSearch} loading={loading} error={error} success={success} onSearch={(event) => { event.preventDefault(); void load(1); }} onClear={() => { void load(1, true); }} onPage={(page) => { void load(page); }} onToggle={(item) => { void toggle(item); }} />
    </div>
  );
}

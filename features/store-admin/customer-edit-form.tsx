import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { CustomerDetail } from "@white-label/customers";
import { updateMerchantCustomer } from "../../lib/server/operations-customers.functions.ts";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function CustomerEditForm({
  customer,
}: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await updateMerchantCustomer({
        data: {
          id: customer.id,
          input: {
            name: field(form, "name"),
            phone: field(form, "phone") || null,
            email: field(form, "email") || null,
            document: field(form, "document") || null,
            birthDate: field(form, "birthDate") || null,
            notes: field(form, "notes") || null,
          },
        },
      });
      setMessage("Cliente atualizado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="k-document-form" onSubmit={(event) => { void submit(event); }}>
      <header className="k-document-section__head">
        <div>
          <span className="k-section-kicker">Cadastro</span>
          <h2>Dados do cliente</h2>
        </div>
      </header>
      <div className="k-form__grid">
        <div className="k-field"><label htmlFor="edit-name">Nome</label><input id="edit-name" name="name" defaultValue={customer.name} required /></div>
        <div className="k-field"><label htmlFor="edit-phone">Telefone</label><input id="edit-phone" name="phone" defaultValue={customer.phone ?? ""} /></div>
        <div className="k-field"><label htmlFor="edit-email">E-mail</label><input id="edit-email" name="email" type="email" defaultValue={customer.email ?? ""} /></div>
        <div className="k-field"><label htmlFor="edit-document">Documento</label><input id="edit-document" name="document" defaultValue={customer.document ?? ""} /></div>
        <div className="k-field"><label htmlFor="edit-birth">Nascimento</label><input id="edit-birth" name="birthDate" type="date" defaultValue={customer.birthDate?.slice(0, 10) ?? ""} /></div>
        <div className="k-field k-field--full"><label htmlFor="edit-notes">Observações</label><textarea id="edit-notes" name="notes" defaultValue={customer.notes ?? ""} /></div>
      </div>
      <footer className="k-document-form__footer">
        {message ? <span className="k-status">{message}</span> : null}
        <button className="k-button k-button--primary" disabled={busy} type="submit">
          {busy ? "Salvando…" : "Salvar alterações"}
        </button>
      </footer>
    </form>
  );
}

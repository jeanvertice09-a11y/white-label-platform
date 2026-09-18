import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { createMerchantCustomer } from "../../lib/server/operations-customers.functions.ts";

export function CustomerCreateForm(): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await createMerchantCustomer({ data: {
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? "") || null,
        email: String(form.get("email") ?? "") || null,
        document: String(form.get("document") ?? "") || null,
        birthDate: String(form.get("birthDate") ?? "") || null,
        notes: String(form.get("notes") ?? "") || null,
      } });
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o cliente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="k-card k-form" onSubmit={(event) => { void submit(event); }}>
      <h2>Novo cliente</h2>
      <div className="k-form__grid">
        <div className="k-field"><label htmlFor="customer-name">Nome</label><input id="customer-name" name="name" required /></div>
        <div className="k-field"><label htmlFor="customer-phone">Telefone</label><input id="customer-phone" name="phone" inputMode="tel" /></div>
        <div className="k-field"><label htmlFor="customer-email">E-mail</label><input id="customer-email" name="email" type="email" /></div>
        <div className="k-field"><label htmlFor="customer-document">Documento</label><input id="customer-document" name="document" /></div>
        <div className="k-field"><label htmlFor="customer-birth">Nascimento</label><input id="customer-birth" name="birthDate" type="date" /></div>
        <div className="k-field k-field--full"><label htmlFor="customer-notes">Observações</label><textarea id="customer-notes" name="notes" /></div>
      </div>
      {message ? <div className="k-status k-danger">{message}</div> : null}
      <div className="k-actions"><button className="k-button k-button--primary" disabled={busy} type="submit">Salvar cliente</button></div>
    </form>
  );
}

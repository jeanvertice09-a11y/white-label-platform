import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { CustomerDetail } from "@white-label/customers";
import { Button } from "../../admin/ui/Button.tsx";
import { Input, Textarea } from "../../admin/ui/Field.tsx";
import { Section } from "../../admin/ui/Section.tsx";
import styles from "../../admin/ui/Section.module.css";
import { updateMerchantCustomer } from "../../lib/server/operations-customers.functions.ts";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function CustomerEditForm({ customer }: Readonly<{ customer: CustomerDetail }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await updateMerchantCustomer({ data: { id: customer.id, input: {
        name: field(form, "name"), phone: field(form, "phone") || null,
        email: field(form, "email") || null, document: field(form, "document") || null,
        birthDate: field(form, "birthDate") || null, notes: field(form, "notes") || null,
      } } });
      setMessage("Cliente atualizado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Dados do cliente" description="Cadastro e informações de contato">
      <form onSubmit={(event) => { void submit(event); }}>
        <div className={styles.formGrid}>
          <Input label="Nome" id="edit-name" name="name" defaultValue={customer.name} required />
          <Input label="Telefone" id="edit-phone" name="phone" defaultValue={customer.phone ?? ""} />
          <Input label="E-mail" id="edit-email" name="email" type="email" defaultValue={customer.email ?? ""} />
          <Input label="Documento" id="edit-document" name="document" defaultValue={customer.document ?? ""} />
          <Input label="Nascimento" id="edit-birth" name="birthDate" type="date" defaultValue={customer.birthDate?.slice(0, 10) ?? ""} />
          <div className={styles.fullField}><Textarea label="Observações" id="edit-notes" name="notes" defaultValue={customer.notes ?? ""} /></div>
        </div>
        <div className={styles.formFooter}>
          {message ? <span className={styles.feedback} role="status">{message}</span> : null}
          <Button tone="primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar alterações"}</Button>
        </div>
      </form>
    </Section>
  );
}

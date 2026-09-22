import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { StoreRole, TenantRole } from "@white-label/auth";
import type { ControlTeamWorkspace } from "../../lib/server/control-team.types.ts";
import {
  removeStoreMemberAction,
  removeTenantMemberAction,
  saveStoreMemberAction,
  saveTenantMemberAction,
} from "../../lib/server/control-team.functions.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { roleLabel } from "../../lib/ui-labels.ts";
import { ControlPageHeader } from "./control-page-header.tsx";

const TENANT_ROLES: readonly TenantRole[] = [
  "tenant_owner",
  "tenant_admin",
  "tenant_finance",
  "tenant_support",
];
const STORE_ROLES: readonly Exclude<StoreRole, "store_owner">[] = [
  "store_admin",
  "store_manager",
  "store_staff",
];

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
function date(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}
function tenantRole(value: string): TenantRole {
  return TENANT_ROLES.includes(value as TenantRole) ? value as TenantRole : "tenant_support";
}
function storeRole(value: string): Exclude<StoreRole, "store_owner"> {
  return STORE_ROLES.includes(value as Exclude<StoreRole, "store_owner">)
    ? value as Exclude<StoreRole, "store_owner">
    : "store_staff";
}

function TenantMemberForm({ initial }: Readonly<{ initial: ControlTeamWorkspace }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await saveTenantMemberAction({ data: { email: text(form, "email"), role: tenantRole(text(form, "role")) } });
      setMessage("Acesso da White Label salvo.");
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o acesso.");
    } finally { setBusy(false); }
  }
  return <form className="k-form" onSubmit={(event) => { void submit(event); }}>
    <div className="k-form__grid">
      <label>Usuário existente<input type="email" name="email" placeholder="usuario@empresa.com" required /></label>
      <label>Perfil<select name="role" defaultValue="tenant_support">
        {TENANT_ROLES.filter((role) => role !== "tenant_owner" || initial.canManageOwners).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
      </select></label>
    </div>
    <button className="k-button" disabled={busy}>Salvar acesso</button>
    <p className="k-muted">Somente usuários já existentes no Supabase Auth podem ser vinculados. Nenhum convite ou conta é criado aqui.</p>
    {message ? <p className="k-status" role="status">{message}</p> : null}
  </form>;
}

function TenantMembers({ initial }: Readonly<{ initial: ControlTeamWorkspace }>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function remove(userId: string): Promise<void> {
    try {
      await removeTenantMemberAction({ data: { userId } });
      setMessage("Membership removida.");
      await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível remover."); }
  }
  return <section className="control-editorial-section">
    <div className="control-editorial-section__header"><div><h2>Acesso à White Label</h2><p>Perfis válidos do tenant, sem permissões inventadas.</p></div></div>
    {initial.canManage ? <TenantMemberForm initial={initial} /> : <p className="k-muted">Somente Responsável principal ou Administrador pode alterar a equipe.</p>}
    <div className="console-compact-list">{initial.tenantMembers.map((member) => {
      const ownerLocked = member.role === "tenant_owner" && !initial.canManageOwners;
      return <div className="console-compact-row" key={member.userId}><div><strong>{member.email ?? member.userId}</strong><small>{roleLabel(member.role)} · desde {date(member.createdAt)}</small></div>
        {initial.canManage && !ownerLocked ? <button className="k-button" type="button" onClick={() => {
          if (confirmDangerousAction(`Remover o acesso de ${member.email ?? member.userId}?`)) void remove(member.userId);
        }}>Remover</button> : null}
      </div>;
    })}</div>
    {message ? <p className="k-status" role="status">{message}</p> : null}
  </section>;
}

function StoreMemberForm({ initial }: Readonly<{ initial: ControlTeamWorkspace }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await saveStoreMemberAction({ data: {
        storeId: text(form, "storeId"),
        email: text(form, "email"),
        role: storeRole(text(form, "role")),
      } });
      setMessage("Acesso da loja salvo.");
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o acesso da loja."); }
    finally { setBusy(false); }
  }
  return <form className="k-form" onSubmit={(event) => { void submit(event); }}>
    <div className="k-form__grid">
      <label>Loja<select name="storeId" required defaultValue=""><option value="" disabled>Selecione</option>{initial.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <label>Usuário existente<input type="email" name="email" required /></label>
      <label>Perfil<select name="role" defaultValue="store_staff">{STORE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
    </div>
    <button className="k-button" disabled={busy}>Salvar acesso da loja</button>
    {message ? <p className="k-status" role="status">{message}</p> : null}
  </form>;
}

function StoreMembers({ initial }: Readonly<{ initial: ControlTeamWorkspace }>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function remove(storeId: string, userId: string): Promise<void> {
    try {
      await removeStoreMemberAction({ data: { storeId, userId } });
      setMessage("Acesso da loja removido.");
      await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível remover."); }
  }
  return <section className="control-editorial-section">
    <div className="control-editorial-section__header"><div><h2>Acesso às lojas</h2><p>O Responsável principal da loja permanece no fluxo dedicado do lojista.</p></div></div>
    {initial.canManage ? <StoreMemberForm initial={initial} /> : null}
    <div className="console-compact-list">{initial.storeMembers.map((member) => <div className="console-compact-row" key={`${member.storeId}:${member.userId}`}><div><strong>{member.email ?? member.userId}</strong><small>{member.storeName} · {roleLabel(member.role)} · desde {date(member.createdAt)}</small></div>
      {initial.canManage && member.role !== "store_owner" ? <button className="k-button" type="button" onClick={() => {
        if (confirmDangerousAction(`Remover este acesso de ${member.storeName}?`)) void remove(member.storeId, member.userId);
      }}>Remover</button> : null}
    </div>)}</div>
    {message ? <p className="k-status" role="status">{message}</p> : null}
  </section>;
}

export function ControlTeamPage({ initial }: Readonly<{ initial: ControlTeamWorkspace }>): React.JSX.Element {
  return <section className="control-section">
    <ControlPageHeader kicker="Administração" title="Equipe e acessos" description="Gerencie memberships existentes com escopo server-side por White Label e loja." />
    <TenantMembers initial={initial} />
    <StoreMembers initial={initial} />
  </section>;
}

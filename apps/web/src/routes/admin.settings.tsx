import { createFileRoute, Link } from "@tanstack/react-router";
import { MerchantStoreSettingsForm } from "../features/store-admin/merchant-store-settings-form.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { PublicCatalogActions } from "../features/store-admin/public-catalog-actions.tsx";
import { getMerchantStorefrontStatus } from "../lib/server/catalog.functions.ts";
import { getMerchantSettingsOverview } from "../lib/server/merchant-settings.functions.ts";
import { statusLabel } from "../lib/ui-labels.ts";

export const Route = createFileRoute("/admin/settings")({
  loader: async () => {
    const [settings, storefront] = await Promise.all([
      getMerchantSettingsOverview(),
      getMerchantStorefrontStatus(),
    ]);
    return { settings, storefront };
  },
  component: SettingsPage,
});

function money(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function intervalLabel(value: string): string {
  if (value === "monthly") return "Mensal";
  if (value === "quarterly") return "Trimestral";
  if (value === "yearly") return "Anual";
  return value;
}

function SettingsPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  const domain = data.storefront.domain;
  const plan = data.settings.plan;
  const publicUrl = domain?.previewUrl ?? null;
  return (
    <div className="k-page">
      <PageHead title="Configurações" description="Administre as informações e a presença pública da sua loja." />

      <section className="k-workspace-section">
        <header className="k-section-head"><div><span className="k-section-kicker">Loja</span><h2>Informações da loja</h2><p>Dados públicos de identidade e contato. O escopo da loja é resolvido e validado no servidor.</p></div></header>
        <MerchantStoreSettingsForm name={data.settings.store.name} profile={data.settings.store.profile} />
      </section>

      <section className="k-workspace-section">
        <header className="k-section-head"><div><span className="k-section-kicker">Presença pública</span><h2>Catálogo, identidade e domínio</h2><p>Use as áreas especializadas sem duplicar regras de catálogo, SEO ou aparência.</p></div></header>
        <div className="k-config-list">
          <Link className="k-config-row" to="/admin/store/appearance"><span><strong>Aparência</strong><small>Layout, cores e tipografia da loja.</small></span><b aria-hidden="true">→</b></Link>
          <Link className="k-config-row" to="/admin/store/catalog"><span><strong>Catálogo, WhatsApp e SEO</strong><small>{data.settings.catalog.whatsappPhone ? `WhatsApp ${data.settings.catalog.whatsappPhone}` : "WhatsApp não informado"} · {data.settings.catalog.seoTitle || data.settings.catalog.seoDescription ? "SEO configurado" : "SEO básico ainda não configurado"}</small></span><b aria-hidden="true">→</b></Link>
          <Link className="k-config-row" to="/admin/store"><span><strong>Minha Loja</strong><small>Status, banners e visão geral da experiência pública.</small></span><b aria-hidden="true">→</b></Link>
        </div>
        <div className="k-card">
          <dl className="k-detail-list">
            <div><dt>Status da loja</dt><dd>{statusLabel(data.storefront.store.storeStatus)}</dd></div>
            <div><dt>Status da White Label</dt><dd>{statusLabel(data.storefront.store.tenantStatus)}</dd></div>
            <div><dt>Domínio atual</dt><dd>{domain?.hostname ?? "Ainda não configurado"}</dd></div>
            <div><dt>Status do domínio</dt><dd>{domain ? statusLabel(domain.status) : "—"}</dd></div>
            <div><dt>URL pública</dt><dd>{publicUrl ?? "Disponível após domínio ativo e verificado"}</dd></div>
          </dl>
          {publicUrl ? <PublicCatalogActions url={publicUrl} storeName={data.settings.store.name} /> : <p className="k-inline-state">A configuração ou solicitação de domínio continua sob o fluxo administrativo da White Label; nenhum provisionamento é feito pelo navegador.</p>}
        </div>
      </section>

      <section className="k-workspace-section">
        <header className="k-section-head"><div><span className="k-section-kicker">Conta e plano</span><h2>Seu acesso e assinatura atual</h2><p>Informações somente de leitura; alterações de plano continuam no fluxo administrativo/billing existente.</p></div></header>
        <div className="k-card">
          <h3>Plano atual</h3>
          {plan ? <dl className="k-detail-list">
            <div><dt>Plano</dt><dd>{plan.name}</dd></div>
            <div><dt>Status</dt><dd>{statusLabel(plan.status)}</dd></div>
            <div><dt>Valor</dt><dd>{money(plan.priceCents)} / {intervalLabel(plan.billingInterval).toLowerCase()}</dd></div>
            <div><dt>Fim do trial</dt><dd>{dateLabel(plan.trialEndsAt)}</dd></div>
            <div><dt>Próximo período</dt><dd>{dateLabel(plan.currentPeriodEndsAt)}</dd></div>
          </dl> : <p className="k-inline-state">Nenhuma assinatura comercial foi encontrada para esta loja.</p>}
        </div>
        <div className="k-card">
          <h3>Minha conta</h3>
          <dl className="k-detail-list">
            <div><dt>E-mail de acesso</dt><dd>{data.settings.account.email ?? "—"}</dd></div>
            <div><dt>Telefone da conta</dt><dd>{data.settings.account.phone ?? "—"}</dd></div>
            <div><dt>Conta criada em</dt><dd>{dateLabel(data.settings.account.createdAt)}</dd></div>
          </dl>
          <p className="k-muted">Estes dados vêm da conta autenticada. A edição de credenciais não é simulada nesta tela porque não existe um fluxo próprio seguro de perfil no backend atual.</p>
        </div>
      </section>
    </div>
  );
}

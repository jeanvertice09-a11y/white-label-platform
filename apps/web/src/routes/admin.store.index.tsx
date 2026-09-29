import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { Section } from "../admin/ui/Section.tsx";
import { StatusDot } from "../admin/ui/StatusDot.tsx";
import { statusLabel } from "../lib/ui-labels.ts";
import { getMerchantCatalogOverview, getMerchantStorefrontStatus } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/")({
  loader: async () => {
    const [catalog, storefront] = await Promise.all([
      getMerchantCatalogOverview(),
      getMerchantStorefrontStatus(),
    ]);
    return { catalog, storefront };
  },
  component: StorePage,
});

function statusTone(status: string): "default" | "ok" | "warning" | "danger" {
  const normalized = status.toLowerCase();
  if (["active", "verified", "published", "paid", "completed"].includes(normalized)) return "ok";
  if (["pending", "draft", "processing"].includes(normalized)) return "warning";
  if (["inactive", "failed", "blocked", "suspended", "cancelled", "canceled"].includes(normalized)) return "danger";
  return "default";
}

function StorePage(): React.JSX.Element {
  const { catalog, storefront } = Route.useLoaderData();
  const domain = storefront.domain;
  return (
    <>
      <PageHeader title="Minha loja" description="Configure a experiência pública e acompanhe a disponibilidade da sua loja." />
      <Section title="Experiência da loja" description="Identidade, conteúdo e checkout organizados por área.">
        <ul>
          <li><Link to="/admin/store/appearance">Aparência</Link> — Layout, cores e tipografia.</li>
          <li><Link to="/admin/store/banners">Banners</Link> — {catalog.banners.length === 1 ? "1 banner cadastrado" : `${catalog.banners.length} banners cadastrados`}.</li>
          <li><Link to="/admin/store/catalog">Catálogo e checkout</Link> — {catalog.products.total === 1 ? "1 produto" : `${catalog.products.total} produtos`}, busca, categorias, WhatsApp e informações para buscadores.</li>
        </ul>
      </Section>
      <Section title="Loja pública" description={domain?.hostname ?? "Domínio ainda não configurado"}>
        <p>{domain?.previewUrl ? <a href={domain.previewUrl} target="_blank" rel="noreferrer">Abrir loja pública</a> : "A loja pública fica disponível quando o domínio estiver ativo e verificado."}</p>
        <dl>
          <div><dt>Loja</dt><dd><StatusDot label={statusLabel(storefront.store.storeStatus)} tone={statusTone(storefront.store.storeStatus)} /></dd></div>
          <div><dt>White Label</dt><dd><StatusDot label={statusLabel(storefront.store.tenantStatus)} tone={statusTone(storefront.store.tenantStatus)} /></dd></div>
          {domain ? <div><dt>Domínio</dt><dd><StatusDot label={statusLabel(domain.status)} tone={statusTone(domain.status)} /></dd></div> : null}
        </dl>
      </Section>
    </>
  );
}

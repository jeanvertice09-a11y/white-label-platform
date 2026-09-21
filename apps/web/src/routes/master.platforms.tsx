import { Link, createFileRoute } from "@tanstack/react-router";
import type { MasterWhiteLabelDetail, MasterWhiteLabelListResult } from "../lib/server/master-white-label.types.ts";
import { MasterEmptyState, MasterPageHeader, MasterPanel } from "../components/master/ui.tsx";
import { masterDate } from "../components/master/format.ts";
import { MasterWhiteLabelCreateForm } from "../features/master/master-white-label-create-form.tsx";
import { MasterWhiteLabelDetailView } from "../features/master/master-white-label-detail.tsx";
import { listMasterWhiteLabels, getMasterWhiteLabel } from "../lib/server/master-white-label.functions.ts";
import { statusLabel } from "../lib/ui-labels.ts";

interface PlatformsSearch { tenantId?: string; }
interface PlatformsLoaderData { result: MasterWhiteLabelListResult | null; detail: MasterWhiteLabelDetail | null; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/master/platforms")({
  validateSearch: (search: Record<string, unknown>): PlatformsSearch => {
    const tenantId = search["tenantId"];
    return typeof tenantId === "string" && UUID.test(tenantId) ? { tenantId } : {};
  },
  loaderDeps: ({ search }) => ({ tenantId: search.tenantId }),
  loader: async ({ deps }): Promise<PlatformsLoaderData> => deps.tenantId
    ? { result: null, detail: await getMasterWhiteLabel({ data: { tenantId: deps.tenantId } }) }
    : { result: await listMasterWhiteLabels({ data: { page: 1, pageSize: 20 } }), detail: null },
  component: MasterPlatformsPage,
});

function MasterPlatformsPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  if (search.tenantId) {
    return data.detail
      ? <MasterWhiteLabelDetailView detail={data.detail} />
      : <div className="master-page"><MasterPageHeader title="White Label não encontrada" description="O identificador informado não corresponde a uma White Label disponível para o master." /><MasterEmptyState title="Sem dados" description="Volte para a lista e escolha uma White Label existente." /><Link className="k-button" to="/master/platforms" search={{}}>Voltar</Link></div>;
  }
  if (!data.result) throw new Error("Lista de White Labels indisponível");
  return <MasterPlatformsList result={data.result} />;
}

function MasterPlatformsList({ result }: Readonly<{ result: MasterWhiteLabelListResult }>): React.JSX.Element {
  return (
    <div className="master-page master-page--platforms">
      <MasterPageHeader title="White Labels" description="Cadastre e acompanhe as operações independentes que usam a infraestrutura Kataluu." action={<span>{result.total} operações</span>} />
      <MasterPanel title="Adicionar White Label"><MasterWhiteLabelCreateForm /></MasterPanel>
      <MasterPanel title="Operações cadastradas">
        <div className="master-toolbar"><input type="search" placeholder="Buscar por nome, domínio ou proprietário" aria-label="Buscar White Label" /><select aria-label="Filtrar status"><option>Todos os status</option><option>Ativas</option><option>Em teste</option><option>Suspensas</option></select></div>
        {result.items.length ? <div className="master-table-wrap"><table className="master-table"><thead><tr><th>White Label</th><th>Status</th><th>Responsável</th><th>Lojas</th><th>Domínios</th><th>Criada em</th></tr></thead><tbody>{result.items.map((tenant) => <tr key={tenant.id}><td><Link className="master-table__primary" to="/master/platforms" search={{ tenantId: tenant.id }}>{tenant.name}</Link><div className="master-table__secondary">{tenant.slug}</div></td><td><span className={`master-status master-status--${tenant.status}`}>{statusLabel(tenant.status)}</span></td><td>{tenant.ownerEmail ?? tenant.ownerUserId ?? "Sem responsável"}</td><td>{tenant.storeCount}</td><td>{tenant.domainCount}</td><td>{masterDate(tenant.createdAt)}</td></tr>)}</tbody></table></div> : <MasterEmptyState title="Nenhuma White Label encontrada" description="Cadastre a primeira operação para começar a estruturar o ecossistema da plataforma." />}
      </MasterPanel>
    </div>
  );
}

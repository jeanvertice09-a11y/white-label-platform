import type { CatalogMerchandising } from "@white-label/catalog";
import type { CampaignPage } from "@white-label/marketing";
import { CampaignComposer, CampaignPagination, CampaignSearch } from "./campaign-ui.tsx";
import { CampaignList } from "./campaign-list.tsx";
import { CatalogMerchandisingForm } from "./catalog-merchandising-form.tsx";
import { useCampaignAction, useCampaignListing, useCampaignSave } from "./campaign-manager-hooks.ts";

export function CampaignManager({ initialPage, merchandising }: Readonly<{ initialPage: CampaignPage; merchandising: CatalogMerchandising }>): React.JSX.Element {
  const listing = useCampaignListing(initialPage), saving = useCampaignSave(listing.reload), actions = useCampaignAction(listing.reload);
  const busy = listing.loading || saving.saving || actions.actionBusy;
  const message = actions.actionMessage || saving.saveMessage;
  const mutationError = actions.actionError || saving.saveError;
  return <>
    <CatalogMerchandisingForm initial={merchandising} />
    <section className="k-workspace-section">
      <header className="k-section-head"><div><span className="k-section-kicker">Marketing</span><h2>Campanhas</h2><p>Segmentação com consentimento explícito e preparação segura de destinatários.</p></div><span className="k-section-count">{listing.page.total} campanha(s)</span></header>
      <CampaignComposer busy={busy} save={saving.save} />
      <CampaignSearch busy={busy} search={listing.search} setSearch={listing.setSearch} reload={listing.reload} />
      {listing.loading ? <div className="k-inline-state">Atualizando campanhas…</div> : null}
      {listing.error ? <div className="k-inline-state k-inline-state--error"><strong>Não foi possível carregar</strong><span>{listing.error}</span><button className="k-button" type="button" disabled={busy} onClick={()=>{void listing.reload();}}>Tentar novamente</button></div> : null}
      {mutationError ? <div className="k-inline-state k-inline-state--error"><strong>Operação incompleta</strong><span>{mutationError}</span></div> : null}
      {message ? <div className="k-inline-state"><strong>Concluído</strong><span>{message}</span></div> : null}
      {!listing.error ? <CampaignList page={listing.page} detail={actions.detail} busy={busy} save={saving.save} runAction={actions.runAction} /> : null}
      {!listing.error ? <CampaignPagination busy={busy} page={listing.page.page} pageSize={listing.page.pageSize} total={listing.page.total} reload={listing.reload} /> : null}
    </section>
  </>;
}

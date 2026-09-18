import type { CampaignPage } from "@white-label/marketing";
import {
  CampaignComposer,
  CampaignPagination,
  CampaignSearch,
} from "./campaign-ui.tsx";
import { CampaignList } from "./campaign-list.tsx";
import {
  useCampaignAction,
  useCampaignListing,
  useCampaignSave,
} from "./campaign-manager-hooks.ts";

export function CampaignManager({
  initialPage,
}: Readonly<{ initialPage: CampaignPage }>): React.JSX.Element {
  const listing = useCampaignListing(initialPage);
  const saving = useCampaignSave(listing.reload);
  const actions = useCampaignAction(listing.reload);
  const busy = saving.saving || actions.actionBusy;
  const message = actions.actionMessage || saving.saveMessage;

  return (
    <div className="k-stack">
      <CampaignComposer busy={busy} save={saving.save} />
      <CampaignSearch
        busy={busy}
        search={listing.search}
        setSearch={listing.setSearch}
        reload={listing.reload}
      />
      {message ? <div className="k-status">{message}</div> : null}
      <CampaignList
        page={listing.page}
        detail={actions.detail}
        busy={busy}
        save={saving.save}
        runAction={actions.runAction}
      />
      <CampaignPagination
        busy={busy}
        page={listing.page.page}
        pageSize={listing.page.pageSize}
        total={listing.page.total}
        reload={listing.reload}
      />
    </div>
  );
}

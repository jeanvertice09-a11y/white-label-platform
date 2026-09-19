import type {
  Campaign,
  CampaignDetail,
  CampaignPage,
} from "@white-label/marketing";
import {
  CampaignDetailView,
  CampaignFields,
  statusLabel,
} from "./campaign-ui.tsx";

interface CampaignRowProps {
  campaign: Campaign;
  detail: CampaignDetail | null;
  busy: boolean;
  save: (
    event: React.SyntheticEvent<HTMLFormElement>,
    id?: string,
  ) => Promise<void>;
  runAction: (
    id: string,
    action: "prepare" | "cancel" | "detail",
  ) => Promise<void>;
}

function DraftEditor({
  campaign,
  busy,
  save,
  runAction,
}: Readonly<Omit<CampaignRowProps, "detail">>): React.JSX.Element {
  if (campaign.status !== "draft") return <></>;
  return (
    <form
      className="k-record-editor__form"
      onSubmit={(event) => { void save(event, campaign.id); }}
    >
      <CampaignFields campaign={campaign} />
      <div className="k-record-editor__footer">
        <button className="k-button" disabled={busy} type="submit">Salvar</button>
        <button
          className="k-button k-button--primary"
          disabled={busy}
          onClick={() => { void runAction(campaign.id, "prepare"); }}
          type="button"
        >
          Preparar destinatários
        </button>
      </div>
    </form>
  );
}

function CampaignActions({
  campaign,
  busy,
  runAction,
}: Readonly<Pick<CampaignRowProps, "campaign" | "busy" | "runAction">>) {
  if (campaign.status === "cancelled") return <></>;
  return (
    <div className="k-record-actions">
      <button className="k-text-action" disabled={busy} onClick={() => { void runAction(campaign.id, "detail"); }} type="button">Detalhes</button>
      <button className="k-text-action k-danger" disabled={busy} onClick={() => { void runAction(campaign.id, "cancel"); }} type="button">Cancelar</button>
    </div>
  );
}

function CampaignRow(props: Readonly<CampaignRowProps>): React.JSX.Element {
  const { campaign, detail, busy, save, runAction } = props;
  return (
    <details className="k-record-editor">
      <summary>
        <span className="k-record-editor__identity">
          <strong>{campaign.name}</strong>
          <small>
            {campaign.recipientCount} destinatários
            {campaign.scheduledAt ? ` · ${new Date(campaign.scheduledAt).toLocaleString()}` : ""}
          </small>
        </span>
        <span className={`k-status-pill k-status-pill--${campaign.status}`}>
          {statusLabel(campaign.status)}
        </span>
      </summary>
      <div className="k-record-editor__content">
        <DraftEditor campaign={campaign} busy={busy} save={save} runAction={runAction} />
        <CampaignActions campaign={campaign} busy={busy} runAction={runAction} />
        {detail?.id === campaign.id ? <CampaignDetailView detail={detail} /> : null}
      </div>
    </details>
  );
}

export function CampaignList({
  page,
  detail,
  busy,
  save,
  runAction,
}: Readonly<{
  page: CampaignPage;
  detail: CampaignDetail | null;
  busy: boolean;
  save: CampaignRowProps["save"];
  runAction: CampaignRowProps["runAction"];
}>): React.JSX.Element {
  if (page.items.length === 0) {
    return (
      <div className="k-inline-state">
        <strong>Nenhuma campanha encontrada</strong>
        <span>Crie uma campanha ou ajuste sua busca.</span>
      </div>
    );
  }
  return (
    <div className="k-record-list">
      {page.items.map((campaign) => (
        <CampaignRow
          key={campaign.id}
          campaign={campaign}
          detail={detail}
          busy={busy}
          save={save}
          runAction={runAction}
        />
      ))}
    </div>
  );
}

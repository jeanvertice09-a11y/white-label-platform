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

interface CampaignCardProps {
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
}: Readonly<Omit<CampaignCardProps, "detail">>): React.JSX.Element {
  if (campaign.status !== "draft") return <></>;
  return (
    <form
      className="k-form"
      onSubmit={(event) => {
        void save(event, campaign.id);
      }}
    >
      <CampaignFields campaign={campaign} />
      <div className="k-actions">
        <button className="k-button" disabled={busy} type="submit">
          Salvar
        </button>
        <button
          className="k-button k-button--primary"
          disabled={busy}
          onClick={() => {
            void runAction(campaign.id, "prepare");
          }}
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
}: Readonly<Pick<CampaignCardProps, "campaign" | "busy" | "runAction">>) {
  if (campaign.status === "cancelled") return <></>;
  return (
    <div className="k-actions">
      <button
        className="k-button"
        disabled={busy}
        onClick={() => {
          void runAction(campaign.id, "detail");
        }}
        type="button"
      >
        Ver detalhes
      </button>
      <button
        className="k-button"
        disabled={busy}
        onClick={() => {
          void runAction(campaign.id, "cancel");
        }}
        type="button"
      >
        Cancelar
      </button>
    </div>
  );
}

function CampaignCard(props: Readonly<CampaignCardProps>): React.JSX.Element {
  const { campaign, detail, busy, save, runAction } = props;
  return (
    <details className="k-card">
      <summary>
        <strong>{campaign.name}</strong> · {statusLabel(campaign.status)}
        {" · "}
        {campaign.recipientCount} destinatários
      </summary>
      {campaign.scheduledAt ? (
        <p>Agendada para {new Date(campaign.scheduledAt).toLocaleString()}</p>
      ) : null}
      <DraftEditor
        campaign={campaign}
        busy={busy}
        save={save}
        runAction={runAction}
      />
      <CampaignActions
        campaign={campaign}
        busy={busy}
        runAction={runAction}
      />
      {detail?.id === campaign.id ? (
        <CampaignDetailView detail={detail} />
      ) : null}
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
  save: CampaignCardProps["save"];
  runAction: CampaignCardProps["runAction"];
}>): React.JSX.Element {
  if (page.items.length === 0) {
    return <div className="k-card">Nenhuma campanha encontrada.</div>;
  }
  return (
    <>
      {page.items.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          detail={detail}
          busy={busy}
          save={save}
          runAction={runAction}
        />
      ))}
    </>
  );
}

import { useState } from "react";
import type {
  CampaignDetail,
  CampaignPage,
} from "@white-label/marketing";
import {
  cancelMerchantCampaign,
  createMerchantCampaign,
  getMerchantCampaign,
  listMerchantCampaigns,
  prepareMerchantCampaign,
  updateMerchantCampaign,
} from "../../lib/server/operations-marketing.functions.ts";
import {
  CampaignDetailView,
  CampaignFields,
  readCampaign,
  statusLabel,
} from "./campaign-ui.tsx";

export function CampaignManager({
  initialPage,
}: Readonly<{ initialPage: CampaignPage }>): React.JSX.Element {
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload(nextPage = page.page): Promise<void> {
    const result = await listMerchantCampaigns({
      data: {
        page: nextPage,
        pageSize: page.pageSize,
        search: search || undefined,
      },
    });
    setPage(result);
  }

  async function save(
    event: React.SyntheticEvent<HTMLFormElement>,
    id?: string,
  ): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const input = readCampaign(new FormData(event.currentTarget));
      if (id) {
        await updateMerchantCampaign({ data: { id, input } });
      } else {
        await createMerchantCampaign({ data: input });
        event.currentTarget.reset();
      }
      await reload(1);
      setMessage(id ? "Campanha atualizada." : "Campanha criada.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runAction(
    id: string,
    action: "prepare" | "cancel" | "detail",
  ): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      if (action === "detail") {
        setDetail(await getMerchantCampaign({ data: { id } }));
      } else if (action === "prepare") {
        await prepareMerchantCampaign({ data: { id } });
        setMessage("Campanha preparada. Nenhum envio externo foi realizado.");
        await reload();
      } else {
        await cancelMerchantCampaign({ data: { id } });
        setMessage("Campanha cancelada.");
        await reload();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operação não concluída.",
      );
    } finally {
      setBusy(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="k-stack">
      <form
        className="k-card k-form"
        onSubmit={(event) => {
          void save(event);
        }}
      >
        <h2>Nova campanha</h2>
        <CampaignFields />
        <div className="k-actions">
          <button
            className="k-button k-button--primary"
            disabled={busy}
            type="submit"
          >
            Criar campanha
          </button>
        </div>
      </form>

      <form
        className="k-card k-actions"
        onSubmit={(event) => {
          event.preventDefault();
          void reload(1);
        }}
      >
        <input
          aria-label="Buscar campanhas"
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
          placeholder="Buscar campanha"
          value={search}
        />
        <button className="k-button" disabled={busy} type="submit">
          Buscar
        </button>
      </form>

      {message ? <div className="k-status">{message}</div> : null}

      {page.items.length === 0 ? (
        <div className="k-card">Nenhuma campanha encontrada.</div>
      ) : (
        page.items.map((campaign) => (
          <details className="k-card" key={campaign.id}>
            <summary>
              <strong>{campaign.name}</strong> · {statusLabel(campaign.status)}
              {" · "}
              {campaign.recipientCount} destinatários
            </summary>
            {campaign.scheduledAt ? (
              <p>
                Agendada para{" "}
                {new Date(campaign.scheduledAt).toLocaleString()}
              </p>
            ) : null}
            {campaign.status === "draft" ? (
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
            ) : null}
            {campaign.status !== "cancelled" ? (
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
            ) : null}
            {detail?.id === campaign.id ? (
              <CampaignDetailView detail={detail} />
            ) : null}
          </details>
        ))
      )}

      <div className="k-actions">
        <button
          className="k-button"
          disabled={busy || page.page <= 1}
          onClick={() => {
            void reload(page.page - 1);
          }}
          type="button"
        >
          Anterior
        </button>
        <span>
          Página {page.page} de {lastPage}
        </span>
        <button
          className="k-button"
          disabled={busy || page.page >= lastPage}
          onClick={() => {
            void reload(page.page + 1);
          }}
          type="button"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

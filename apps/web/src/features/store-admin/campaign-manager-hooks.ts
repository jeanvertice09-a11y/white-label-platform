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
import { readCampaign } from "./campaign-ui.tsx";

export function useCampaignListing(initialPage: CampaignPage) {
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reload(nextPage = page.page): Promise<void> {
    setLoading(true); setError("");
    try {
    const result = await listMerchantCampaigns({
      data: {
        page: nextPage,
        pageSize: page.pageSize,
        search: search || undefined,
      },
    });
    setPage(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as campanhas.");
    } finally { setLoading(false); }
  }

  return { page, search, setSearch, reload, loading, error };
}

export function useCampaignSave(
  reload: (page?: number) => Promise<void>,
) {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  async function save(
    event: React.SyntheticEvent<HTMLFormElement>,
    id?: string,
  ): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      const input = readCampaign(new FormData(event.currentTarget));
      if (id) {
        await updateMerchantCampaign({ data: { id, input } });
      } else {
        await createMerchantCampaign({ data: input });
        event.currentTarget.reset();
      }
      await reload(1);
      setSaveMessage(id ? "Campanha atualizada." : "Campanha criada.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return { saving, saveMessage, save };
}

export function useCampaignAction(
  reload: (page?: number) => Promise<void>,
) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  async function runAction(
    id: string,
    action: "prepare" | "cancel" | "detail",
  ): Promise<void> {
    setActionBusy(true);
    setActionMessage("");
    try {
      if (action === "detail") {
        setDetail(await getMerchantCampaign({ data: { id } }));
      } else if (action === "prepare") {
        await prepareMerchantCampaign({ data: { id } });
        setActionMessage(
          "Campanha preparada. Nenhum envio externo foi realizado.",
        );
        await reload();
      } else {
        await cancelMerchantCampaign({ data: { id } });
        setActionMessage("Campanha cancelada.");
        await reload();
      }
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Operação não concluída.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  return { detail, actionBusy, actionMessage, runAction };
}

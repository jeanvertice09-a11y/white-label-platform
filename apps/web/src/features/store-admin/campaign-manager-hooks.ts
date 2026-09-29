import { useState } from "react";
import type { CampaignDetail, CampaignPage } from "@white-label/marketing";
import { cancelMerchantCampaign, createMerchantCampaign, getMerchantCampaign, listMerchantCampaigns, prepareMerchantCampaign, updateMerchantCampaign } from "../../lib/server/operations-marketing.functions.ts";
import { readCampaign } from "./campaign-ui.tsx";

export function useCampaignListing(initialPage: CampaignPage) {
  const [page, setPage] = useState(initialPage), [search, setSearch] = useState(""), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function reload(nextPage = page.page, clearSearch = false): Promise<boolean> {
    setLoading(true); setError("");
    try {
      const effectiveSearch = clearSearch ? "" : search;
      const result = await listMerchantCampaigns({ data: { page: nextPage, pageSize: page.pageSize, search: effectiveSearch.trim() || undefined } });
      if (clearSearch) setSearch("");
      setPage(result); return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as campanhas."); return false;
    } finally { setLoading(false); }
  }
  return { page, search, setSearch, reload, loading, error };
}

export function useCampaignSave(reload: (page?: number, clearSearch?: boolean) => Promise<boolean>) {
  const [saving, setSaving] = useState(false), [saveMessage, setSaveMessage] = useState(""), [saveError, setSaveError] = useState("");
  async function save(event: React.SyntheticEvent<HTMLFormElement>, id?: string): Promise<void> {
    event.preventDefault(); const form = event.currentTarget; setSaving(true); setSaveMessage(""); setSaveError("");
    try {
      const input = readCampaign(new FormData(form));
      if (id) await updateMerchantCampaign({ data: { id, input } }); else await createMerchantCampaign({ data: input });
      const refreshed = await reload(1, !id);
      if (!refreshed) throw new Error("A campanha foi salva, mas a lista não pôde ser atualizada. Tente recarregar.");
      if (!id) form.reset();
      setSaveMessage(id ? "Campanha atualizada." : "Campanha criada.");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return { saving, saveMessage, saveError, save };
}

export function useCampaignAction(reload: (page?: number, clearSearch?: boolean) => Promise<boolean>) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null), [actionBusy, setActionBusy] = useState(false), [actionMessage, setActionMessage] = useState(""), [actionError, setActionError] = useState("");
  async function runAction(id: string, action: "prepare" | "cancel" | "detail"): Promise<void> {
    setActionBusy(true); setActionMessage(""); setActionError("");
    try {
      if (action === "detail") { setDetail(await getMerchantCampaign({ data: { id } })); return; }
      if (action === "prepare") { await prepareMerchantCampaign({ data: { id } }); setActionMessage("Campanha preparada. Nenhum envio externo foi realizado."); }
      else { await cancelMerchantCampaign({ data: { id } }); setActionMessage("Campanha cancelada."); }
      const refreshed = await reload();
      if (!refreshed) setActionError("A operação foi concluída, mas a lista não pôde ser atualizada. Tente novamente.");
    } catch (error) { setActionError(error instanceof Error ? error.message : "Operação não concluída."); }
    finally { setActionBusy(false); }
  }
  return { detail, actionBusy, actionMessage, actionError, runAction };
}

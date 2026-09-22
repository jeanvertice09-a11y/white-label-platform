import { useState } from "react";
import { getCurrentStoreDataExport } from "../../lib/server/data-export.functions.ts";

function downloadJson(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kataluu-store-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function StoreDataExport(): React.JSX.Element {
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");

  async function runExport(): Promise<void> {
    setExporting(true);
    setStatus("");
    try {
      const result = await getCurrentStoreDataExport();
      downloadJson(result);
      setStatus("Exportação gerada com o escopo atual da loja.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível gerar a exportação.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="k-card">
      <h3>Exportação de dados</h3>
      <p className="k-muted">Gera um JSON da loja atual com dados operacionais e pessoais sob seu escopo. Apenas owner/admin da loja podem exportar; segredos, credenciais, tokens e dados de outras lojas não entram no arquivo.</p>
      <div className="k-actions">
        {status ? <span className="k-status" role="status">{status}</span> : null}
        <button className="k-button" type="button" disabled={exporting} onClick={() => { void runExport(); }}>
          {exporting ? "Gerando…" : "Exportar dados da loja"}
        </button>
      </div>
    </div>
  );
}

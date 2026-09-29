import { useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  IMPORT_TEMPLATE,
  MAX_IMPORT_BYTES,
  type ImportIssue,
  type RawImportRow,
  parseCsvText,
} from "../../lib/bulk-import.ts";
import {
  commitMerchantProductImport,
  validateMerchantProductImport,
} from "../../lib/server/bulk-import.functions.ts";

interface PreviewItem {
  line: number;
  name: string;
  sku: string | null;
  category: string | null;
  priceCents: number;
  stockQuantity: number;
  variantCount: number;
  active: boolean;
}

interface PreviewState {
  totalRows: number;
  totalValid: number;
  totalInvalid: number;
  issues: ImportIssue[];
  preview: PreviewItem[];
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function serverRows(rows: RawImportRow[]): Array<{ line: number; values: Record<string, string> }> {
  return rows.map((row) => {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(row.values)) {
      if (value !== undefined) values[key] = value;
    }
    return { line: row.line, values };
  });
}

function downloadTemplate(): void {
  const blob = new Blob(["\uFEFF", IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-importacao-produtos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function readUtf8Csv(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Formato inválido. Envie um arquivo .csv");
  if (file.size === 0) throw new Error("Arquivo CSV vazio");
  if (file.size > MAX_IMPORT_BYTES) throw new Error(`Arquivo muito grande. Limite por importação: ${String(Math.round(MAX_IMPORT_BYTES / 1_000_000))} MB`);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error("Encoding inválido. Salve o CSV em UTF-8");
  }
}

function ImportPreview(props: Readonly<{ preview: PreviewState; busy: boolean; onConfirm: () => void }>): React.JSX.Element {
  const { preview } = props;
  return (
    <>
      <div className="k-import__summary" aria-label="Resumo da validação">
        <div className="k-card"><strong>{preview.totalRows}</strong><span>linhas</span></div>
        <div className="k-card"><strong>{preview.totalValid}</strong><span>válidas</span></div>
        <div className="k-card"><strong>{preview.totalInvalid}</strong><span>inválidas</span></div>
      </div>
      {preview.issues.length > 0 ? (
        <div className="k-card k-import__errors">
          <h3>Erros encontrados</h3>
          <ul>{preview.issues.slice(0, 100).map((item, index) => (
            <li key={`${String(item.line ?? 0)}-${item.field}-${String(index)}`}>Linha {item.line ?? "—"} · <strong>{item.field}</strong>: {item.message}</li>
          ))}</ul>
          {preview.issues.length > 100 ? <p>Existem mais {preview.issues.length - 100} erro(s).</p> : null}
        </div>
      ) : null}
      {preview.preview.length > 0 ? (
        <div className="k-table-wrap"><table className="k-table"><thead><tr><th>Linha</th><th>Produto</th><th>SKU</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Variantes</th><th>Status</th></tr></thead><tbody>{preview.preview.map((item) => (
          <tr key={`${String(item.line)}-${item.name}`}><td>{item.line}</td><td><strong>{item.name}</strong></td><td>{item.sku ?? "—"}</td><td>{item.category ?? "Sem categoria"}</td><td>{money(item.priceCents)}</td><td>{item.stockQuantity}</td><td>{item.variantCount}</td><td>{item.active ? "Ativo" : "Inativo"}</td></tr>
        ))}</tbody></table></div>
      ) : null}
      <div className="k-import__actions">
        <button className="k-button k-button--primary" type="button" disabled={props.busy || preview.totalInvalid > 0 || preview.totalValid === 0} onClick={props.onConfirm}>
          {props.busy ? "Importando…" : `Confirmar ${String(preview.totalValid)} produto(s)`}
        </button>
        <span>A confirmação revalida conflitos no servidor antes de gravar.</span>
      </div>
    </>
  );
}

export function BulkImportPanel(): React.JSX.Element {
  const router = useRouter();
  const [rows, setRows] = useState<RawImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ products: number; variants: number; stockMovements: number } | null>(null);

  async function selectFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    setPreview(null); setRows([]); setResult(null); setStatus("");
    if (!file) return;
    setBusy(true); setStatus("Lendo e validando arquivo…");
    try {
      const parsed = parseCsvText(await readUtf8Csv(file));
      const validated = await validateMerchantProductImport({ data: { rows: serverRows(parsed) } });
      setRows(parsed); setPreview(validated);
      setStatus(validated.totalInvalid > 0 ? "Revise os erros antes de importar." : "Arquivo válido. Revise o preview e confirme a importação.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível validar o arquivo.");
    } finally { setBusy(false); }
  }

  async function confirmImport(): Promise<void> {
    if (!preview || preview.totalInvalid > 0 || rows.length === 0) return;
    setBusy(true); setStatus("Importando produtos de forma atômica…"); setResult(null);
    try {
      const imported = await commitMerchantProductImport({ data: { rows: serverRows(rows) } });
      setResult(imported); setStatus("Importação concluída."); setRows([]); setPreview(null);
      await router.invalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível concluir a importação.");
    } finally { setBusy(false); }
  }

  return (
    <section className="k-workspace-section k-import" id="importar-produtos">
      <header className="k-section-head"><div><span className="k-section-kicker">Catálogo</span><h2>Importação em massa</h2><p>Envie CSV em UTF-8. Nada é gravado até você validar, revisar o preview e confirmar.</p></div><button className="k-button k-button--ghost" type="button" onClick={downloadTemplate}>Baixar modelo CSV</button></header>
      <div className="k-card k-import__picker">
        <label htmlFor="bulk-import-file"><strong>Arquivo CSV</strong><span>Até 2 MB e 500 linhas por lote.</span></label>
        <input id="bulk-import-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { void selectFile(event); }} />
        <details><summary>Campos suportados</summary><p>nome, slug, SKU, descrição, preço, preço comparativo, custo, categoria, subcategoria, estoque, status, controle de estoque, posição e variantes reais via JSON.</p></details>
      </div>
      {status ? <div className="k-inline-state" role="status">{busy ? <span className="k-import__spinner" aria-hidden="true" /> : null}<span>{status}</span></div> : null}
      {preview ? <ImportPreview preview={preview} busy={busy} onConfirm={() => { void confirmImport(); }} /> : null}
      {result ? <div className="k-inline-state k-import__success"><strong>Importação concluída</strong><span>{result.products} produto(s), {result.variants} variante(s) e {result.stockMovements} movimento(s) de estoque inicial.</span></div> : null}
    </section>
  );
}

import { ControlBrandingManager } from "./control-branding-manager.tsx";
import { ControlPageHeader } from "./control-page-header.tsx";
import { useControlShellData } from "./control-shell.tsx";

export function ControlBrandingPage(): React.JSX.Element {
  const data = useControlShellData();
  const hasSettings = data.tenant.settings.trim() !== "{}";
  return <div className="control-section">
    <ControlPageHeader kicker="Marca e canais" title="Identidade visual" description="Gerencie as capacidades de marca que já estão disponíveis para esta White Label." />
    <ControlBrandingManager initial={data.tenant} />
    <div className="control-branding-layout">
      <section className="control-branding-block"><div className="control-editorial-section__header"><div><h2>Logo</h2><p>Imagem atualmente configurada para a White Label.</p></div></div><div className="console-brand-preview">{data.tenant.logoUrl ? <img className="control-logo" src={data.tenant.logoUrl} alt={`Logo de ${data.tenant.name}`} /> : <div className="control-empty"><strong>Logo não configurada</strong><p>O upload de arquivos não faz parte deste lote.</p></div>}</div></section>
      <section className="control-branding-block"><div className="control-editorial-section__header"><div><h2>Personalização</h2><p>Cor principal e situação da configuração persistida.</p></div></div><div className="console-brand-color"><span style={{ background: data.tenant.primaryColor ?? "#315efb" }} aria-hidden="true" /><div><strong>{data.tenant.primaryColor ?? "Não configurada"}</strong><small>{hasSettings ? "Personalização configurada" : "Sem configurações adicionais"}</small></div></div></section>
    </div>
  </div>;
}

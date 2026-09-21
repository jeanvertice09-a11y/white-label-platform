import { roleLabel } from "../../lib/ui-labels.ts";
import { ControlPageHeader } from "./control-page-header.tsx";
import { useControlShellData } from "./control-shell.tsx";

function date(value: string): string { return new Date(value).toLocaleDateString("pt-BR"); }

export function ControlTeamPage(): React.JSX.Element {
  const data = useControlShellData();
  return <section className="control-section">
    <ControlPageHeader kicker="Administração" title="Equipe e acessos" description="Consulte as pessoas com acesso à White Label e os perfis já existentes. A gestão de memberships não faz parte deste lote." />
    <section className="control-editorial-section">
      <div className="control-editorial-section__header"><div><h2>Acessos atuais</h2><p>Visão somente leitura; nenhuma credencial é exibida.</p></div></div>
      {data.members.length ? <div className="console-compact-list">{data.members.map((member) => <div className="console-compact-row" key={`${member.userId}:${member.role}`}><div><strong>{roleLabel(member.role)}</strong><small>Identificador técnico: {member.userId}</small></div><span>Desde {date(member.createdAt)}</span></div>)}</div> : <div className="control-empty"><strong>Nenhum acesso encontrado</strong><p>Não há membros cadastrados para esta White Label.</p></div>}
    </section>
  </section>;
}

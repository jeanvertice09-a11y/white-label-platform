import type { PublicDomainState } from "../../lib/public-site.types.ts";

const copy: Record<PublicDomainState, { eyebrow: string; title: string; text: string }> = {
  unknown: {
    eyebrow: "Endereço não reconhecido",
    title: "Este domínio não está vinculado a uma página pública ativa.",
    text: "Confira o endereço informado ou fale com a empresa responsável pela plataforma.",
  },
  configuring: {
    eyebrow: "Domínio em configuração",
    title: "A publicação deste endereço ainda não foi concluída.",
    text: "A configuração de domínio precisa ser finalizada e verificada antes da página ficar disponível.",
  },
  unavailable: {
    eyebrow: "Indisponível",
    title: "Esta experiência não está disponível neste momento.",
    text: "Tente novamente mais tarde ou entre em contato com a empresa responsável pelo endereço.",
  },
};

export function PublicDomainStateView({ state }: Readonly<{ state: PublicDomainState }>): React.JSX.Element {
  const content = copy[state];
  return (
    <main className="public-state"><section><span className="public-eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.text}</p></section></main>
  );
}

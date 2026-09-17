// /catalog — página pública ESTRUTURAL.
// Não usa tenant/store da URL como autoridade: a resolução canônica é por
// hostname via DomainResolver (server). Aqui apenas o esqueleto.
export function CatalogPage(): React.JSX.Element {
  return (
    <section>
      <h1>Catálogo</h1>
      <p>Resolução por hostname (DomainResolver). Nenhum UUID da URL concede acesso.</p>
    </section>
  );
}

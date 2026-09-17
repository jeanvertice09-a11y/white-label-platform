// /master — esqueleto autenticado, reservado a platform_owner/admin.
// A verificação REAL acontece em server function (ver lib/route-guard.ts).
export function MasterPage(): React.JSX.Element {
  return (
    <section>
      <h1>White Label Platform — Master</h1>
      <p>Área da plataforma. Acesso restrito a platform_owner / platform_admin.</p>
      <ul>
        <li>Tenants (placeholder)</li>
        <li>Stores (placeholder)</li>
        <li>Domains (placeholder)</li>
        <li>Security (placeholder)</li>
      </ul>
    </section>
  );
}

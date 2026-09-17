// /control — esqueleto protegido por tenant membership.
export function ControlPage(): React.JSX.Element {
  return (
    <section>
      <h1>Tenant Control</h1>
      <p>Requer membership válida no tenant (tenant_owner/admin/finance/support).</p>
    </section>
  );
}

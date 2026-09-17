// /admin — esqueleto protegido por store membership.
export function StoreAdminPage(): React.JSX.Element {
  return (
    <section>
      <h1>Store Admin</h1>
      <p>Requer store_owner / store_admin / store_manager na store ativa.</p>
    </section>
  );
}

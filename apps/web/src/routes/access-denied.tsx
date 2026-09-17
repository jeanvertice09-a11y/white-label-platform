export function AccessDenied(props: { error: unknown }): React.JSX.Element {
  const err = props.error as { status?: number; message?: string };
  const title = err.status === 401 ? "Sessão necessária" : "Acesso negado";
  return (
    <section>
      <h1>{title}</h1>
      <p>{err.message ?? "Você não tem permissão para acessar esta área."}</p>
    </section>
  );
}

export function AdminRoutePending(): React.JSX.Element {
  return <div className="k-empty">Carregando dados da loja…</div>;
}

export function AdminRouteError(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const message = props.error instanceof Error ? props.error.message : "Não foi possível carregar esta área.";
  return <div className="k-empty"><strong>Área indisponível</strong><span>{message}</span></div>;
}

export function AdminFeatureUnavailable(props: Readonly<{
  title: string;
  description: string;
}>): React.JSX.Element {
  return <div className="k-empty"><strong>{props.title}</strong><span>{props.description}</span></div>;
}

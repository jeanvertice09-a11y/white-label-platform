import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import "../../styles/console-route-state.css";

interface RouteErrorShape {
  status?: number;
  message?: string;
}

export function ConsoleRoutePending(): React.JSX.Element {
  return (
    <main className="console-route-state console-route-state--pending" aria-busy="true">
      <span className="console-state-sr">Carregando painel</span>
      <aside className="console-route-state__sidebar" aria-hidden="true">
        <span className="console-route-state__brand" />
        <span /><span /><span /><span /><span />
      </aside>
      <section className="console-route-state__main" aria-hidden="true">
        <div className="console-route-state__header" />
        <div className="console-route-state__content">
          <span className="console-route-state__title" />
          <span className="console-route-state__subtitle" />
          <div className="console-route-state__summary"><span /><span /><span /><span /></div>
          <div className="console-route-state__panel" />
        </div>
      </section>
    </main>
  );
}

export function ConsoleRouteError(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const error = props.error as RouteErrorShape;
  const navigate = useNavigate();
  useEffect(() => {
    if (error.status === 401) void navigate({ to: "/login", replace: true });
  }, [error.status, navigate]);

  if (error.status === 401) {
    return <ConsoleErrorLayout title="Redirecionando para o login" description="Sua sessão precisa ser validada novamente." />;
  }
  if (error.status === 403) {
    return <ConsoleErrorLayout title="Acesso não autorizado" description={error.message ?? "Sua conta não possui acesso a esta área."} login />;
  }
  if (error.status === 404) {
    return <ConsoleErrorLayout title="Área não encontrada" description="O recurso solicitado não existe ou não está disponível neste contexto." login />;
  }
  return <ConsoleErrorLayout title="Não foi possível carregar o painel" description="Os dados não puderam ser carregados agora. Você pode tentar novamente sem perder a sessão." retry login />;
}

function ConsoleErrorLayout(props: Readonly<{ title: string; description: string; retry?: boolean; login?: boolean }>): React.JSX.Element {
  return (
    <main className="console-route-state console-route-state--error">
      <section className="console-route-error" role="alert">
        <span className="console-route-error__eyebrow">Kataluu</span>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
        <div className="console-route-error__actions">
          {props.retry ? <button type="button" onClick={() => { window.location.reload(); }}>Tentar novamente</button> : null}
          {props.login ? <a href="/login">Ir para login</a> : null}
        </div>
      </section>
    </main>
  );
}

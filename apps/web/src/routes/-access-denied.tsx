import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import "../styles/panel-state.css";

interface RouteErrorShape {
  status?: number;
  message?: string;
}

function StateCard(props: Readonly<{ title: string; message: string; action?: boolean }>): React.JSX.Element {
  return (
    <main className="panel-state">
      <section className="panel-state__card">
        <div className="panel-state__icon" aria-hidden="true">K</div>
        <h1>{props.title}</h1>
        <p>{props.message}</p>
        {props.action ? <a href="/login">Ir para login</a> : null}
      </section>
    </main>
  );
}

export function AccessDenied(props: Readonly<{ error: unknown }>): React.JSX.Element {
  const err = props.error as RouteErrorShape;
  const navigate = useNavigate();

  useEffect(() => {
    if (err.status === 401) {
      void navigate({ to: "/login", replace: true });
    }
  }, [err.status, navigate]);

  if (err.status === 401) {
    return <StateCard title="Redirecionando" message="Estamos levando você para o login seguro." />;
  }
  if (err.status === 403) {
    return <StateCard title="Acesso negado" message={err.message ?? "Você não tem permissão para acessar esta área."} action />;
  }
  return <StateCard title="Não foi possível carregar o painel" message="Ocorreu uma falha interna ao carregar os dados. Tente novamente." />;
}

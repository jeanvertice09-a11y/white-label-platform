import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

interface RouteErrorShape {
  status?: number;
  message?: string;
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
    return <section><h1>Redirecionando para login...</h1></section>;
  }

  if (err.status === 403) {
    return (
      <section>
        <h1>Acesso negado</h1>
        <p>{err.message ?? "Você não tem permissão para acessar esta área."}</p>
        <p><a href="/login">Ir para login</a></p>
      </section>
    );
  }

  return (
    <section>
      <h1>Não foi possível carregar o painel</h1>
      <p>Ocorreu uma falha interna ao carregar os dados. Tente novamente.</p>
    </section>
  );
}

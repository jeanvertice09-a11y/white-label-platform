import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export function AccessDenied(props: { error: unknown }): React.JSX.Element {
  const err = props.error as { status?: number; message?: string };
  const navigate = useNavigate();

  useEffect(() => {
    if (err.status === 401) {
      void navigate({ to: "/login", replace: true });
    }
  }, [err.status, navigate]);

  if (err.status === 401) {
    return (
      <section>
        <h1>Redirecionando para login...</h1>
      </section>
    );
  }

  const internalError = (err.status ?? 500) >= 500;
  return (
    <section>
      <h1>{internalError ? "Erro ao validar acesso" : "Acesso negado"}</h1>
      <p>{err.message ?? (internalError
        ? "Não foi possível validar suas permissões agora."
        : "Você não tem permissão para acessar esta área.")}</p>
      {!internalError ? <p><a href="/login">Ir para login</a></p> : null}
    </section>
  );
}

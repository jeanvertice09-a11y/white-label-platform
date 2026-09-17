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

  const title = err.status === 401 ? "Redirecionando para login..." : "Acesso negado";
  return (
    <section>
      <h1>{title}</h1>
      <p>{err.message ?? "Você não tem permissão para acessar esta área."}</p>
      {err.status !== 401 && (
        <p><a href="/login">Ir para login</a></p>
      )}
    </section>
  );
}
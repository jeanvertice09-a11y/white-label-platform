import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Customer } from "@white-label/customers";

export function CustomersList({ customers }: Readonly<{ customers: Customer[] }>): React.JSX.Element {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return customers;
    return customers.filter((customer) =>
      customer.name.toLocaleLowerCase("pt-BR").includes(term)
      || (customer.phone ?? "").includes(term)
      || (customer.email ?? "").toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [customers, search]);

  return (
    <div className="k-stack">
      <div className="k-field"><label htmlFor="customer-search">Buscar clientes</label><input id="customer-search" value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Nome, telefone ou e-mail" /></div>
      {filtered.length ? (
        <div className="k-card k-table-wrap">
          <table className="k-table">
            <thead><tr><th>Cliente</th><th>Telefone</th><th>E-mail</th><th /></tr></thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone ?? "—"}</td>
                  <td>{customer.email ?? "—"}</td>
                  <td><Link className="k-button" to="/admin/customers/$id" params={{ id: customer.id }}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="k-empty">Nenhum cliente encontrado.</div>}
    </div>
  );
}

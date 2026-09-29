# ADR 002-multi-tenant-shared-database

Banco compartilhado com tenant_id/store_id em toda tabela + RLS. Menor custo que schema/DB por tenant; isolamento via FK composta + RLS + contexto.


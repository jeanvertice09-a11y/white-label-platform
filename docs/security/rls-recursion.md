# RLS: sem recursão

Policies de `tenant_members`, `store_members` e `platform_members` nunca
consultam a própria tabela:

- self-read: `user_id = auth.uid()` (comparação direta, sem subquery);
- helpers `is_tenant_member`/`is_store_member`: `SECURITY DEFINER` executando
  como owner (bypassa RLS) + `search_path = public` + `REVOKE PUBLIC` +
  `GRANT` só a `authenticated`.

Por isso nenhuma policy entra em `tenant_members -> tenant_members`.
Teste real em `tests/db/rls-matrix.test.ts` ("sem recursão").

# Bootstrap do primeiro platform_owner

Não existe endpoint público para isso. Ninguém pode se auto-promover:
`platform_members` não possui política de escrita para `authenticated`
(RLS nega) e nenhuma rota escreve nessa tabela.

## Processo (somente operador, ambiente local/staging)

1. Crie o usuário via Supabase Auth (dashboard local ou `supabase auth`):
   anote o `auth.uid()`.
2. Com a **service role local** (nunca commitar, nunca expor), execute:
   ```sql
   insert into public.platform_members (user_id, role)
   values ('<AUTH_UID>', 'platform_owner')
   on conflict (user_id) do update set role = excluded.role;
   ```
3. Confirme em auditoria manual (quem/quando/por quê) fora do banco.
4. Alternativa assistida: `bun scripts/bootstrap-platform-owner.ts`
   (lê `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `TARGET_USER_ID` do
   ambiente; recusa exemplo/placeholder; registra log de auditoria).

## Regras

- Script e SQL operam apenas contra o ambiente indicado na env local.
- Nunca rodar contra produção sem change control separada.
- Depois do primeiro owner, novos membros via área /master autenticada
  (futura mutation server-side com `assertCanAccessMaster`).

# Criação de Usuários de Teste no Supabase Auth (Projeto Remoto)

**NÃO execute SQL direto em `auth.users`.** Use a Admin API do Supabase ou o Dashboard.

---

## Pré-requisitos

- Projeto Supabase ativo (cloud)
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto remoto
- Schema aplicado via `01-schema.sql` e validado via `02-validation.sql`

---

## 1. Via Dashboard (Mais Simples)

1. Acesse: **Supabase Dashboard → Authentication → Users**
2. Clique **Add user** → **Create new user**
3. Crie 5 usuários com email/senha:

| Papel | Email | Senha (sugerida) |
|-------|-------|------------------|
| Platform Owner | `platform-owner@test.local` | `Teste@1234` |
| Tenant A User | `tenant-a@test.local` | `Teste@1234` |
| Tenant B User | `tenant-b@test.local` | `Teste@1234` |
| Store A User | `store-a@test.local` | `Teste@1234` |
| Store B User | `store-b@test.local` | `Teste@1234` |

4. Anote os **UUIDs** (`auth.uid()`) gerados para cada usuário.

---

## 2. Via Admin API (Script Automatizado)

```bash
# Configure estas variáveis:
export SUPABASE_URL="https://SEU-PROJETO.supabase.co"
export SERVICE_ROLE_KEY="sua-service-role-key"

# Crie usuários (retorna JSON com user.id):
curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"platform-owner@test.local","password":"Teste@1234","email_confirm":true}'

curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"tenant-a@test.local","password":"Teste@1234","email_confirm":true}'

curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"tenant-b@test.local","password":"Teste@1234","email_confirm":true}'

curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"store-a@test.local","password":"Teste@1234","email_confirm":true}'

curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"store-b@test.local","password":"Teste@1234","email_confirm":true}'
```

> **Importante:** `email_confirm: true` evita fluxo de confirmação por email.

---

## 3. Inserir Memberships (Após criar usuários no Auth)

Use os UUIDs obtidos acima. Execute no **SQL Editor** do Supabase:

```sql
-- Substitua os UUIDs abaixo pelos valores reais do auth.users

-- Platform Owner
insert into public.platform_members (user_id, role)
values ('UUID_PLATFORM_OWNER', 'platform_owner')
on conflict (user_id) do nothing;

-- Tenants
insert into public.tenants (id, slug, name, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tenant-a', 'Tenant A (teste)', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tenant-b', 'Tenant B (teste)', 'active')
on conflict (id) do nothing;

-- Tenant Members
insert into public.tenant_members (tenant_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'UUID_TENANT_A_USER', 'tenant_owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'UUID_TENANT_B_USER', 'tenant_support')
on conflict (tenant_id, user_id) do nothing;

-- Stores
insert into public.stores (id, tenant_id, slug, name, status) values
  ('aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'loja-a', 'Loja A (teste)', 'active'),
  ('bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'loja-b', 'Loja B (teste)', 'active')
on conflict (id) do nothing;

-- Store Members
insert into public.store_members (tenant_id, store_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa', 'UUID_STORE_A_USER', 'store_admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb', 'UUID_STORE_B_USER', 'store_manager')
on conflict (store_id, user_id) do nothing;
```

> **Nota:** Os UUIDs fixos dos tenants/stores acima são os mesmos usados nos testes automatizados do projeto. Se quiser usar UUIDs aleatórios, gere com `gen_random_uuid()` e use os valores retornados nos inserts subsequentes.

---

## 4. Domínios de Teste (Opcional)

```sql
insert into public.domains (tenant_id, store_id, hostname, type, status, verification_token, verified_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, 'tenant-a.localhost', 'tenant_site', 'active', 'dev-token', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa', 'loja-a.localhost', 'store_catalog', 'active', 'dev-token', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', null, 'tenant-b.localhost', 'tenant_site', 'active', 'dev-token', now())
on conflict (id) do nothing;
```

---

## 5. Validar Login + Sessão (Client)

No browser ou via curl:

```bash
# Login
curl -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"tenant-a@test.local","password":"Teste@1234"}'

# Resposta contém: access_token (JWT), refresh_token, user.id
# Use access_token no header Authorization: Bearer <token> para testar RLS
```

---

## 6. Testar RLS Real com JWT

```bash
# Como Tenant A (deve ver Tenant A, NÃO Tenant B)
curl -X GET "${SUPABASE_URL}/rest/v1/tenants?select=id,slug" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer <ACCESS_TOKEN_TENANT_A>"

# Como Tenant B (deve ver Tenant B, NÃO Tenant A)
curl -X GET "${SUPABASE_URL}/rest/v1/tenants?select=id,slug" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer <ACCESS_TOKEN_TENANT_B>"

# Anon (deve retornar 0 linhas ou 401/403 dependendo da config)
curl -X GET "${SUPABASE_URL}/rest/v1/tenants?select=id,slug" \
  -H "apikey: ${ANON_KEY}"

# Service Role (bypass RLS - apenas server-side!)
curl -X GET "${SUPABASE_URL}/rest/v1/tenants?select=id,slug" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
```

---

## 7. Checklist de Validação Manual

- [ ] 5 usuários criados no Auth (Dashboard ou API)
- [ ] UUIDs anotados
- [ ] Memberships inseridas via SQL Editor
- [ ] Login funciona para cada usuário (retorna JWT válido)
- [ ] Tenant A vê apenas Tenant A (RLS)
- [ ] Tenant B vê apenas Tenant B (RLS)
- [ ] Store A vê apenas Store A (RLS)
- [ ] Store B vê apenas Store B (RLS)
- [ ] Anon não vê dados (deny-by-default)
- [ ] Service role vê tudo (bypass)
- [ ] Platform owner acessa `/master` (via app)
- [ ] Tenant A acessa `/control` (via app)
- [ ] Store A acessa `/admin` (via app)
- [ ] Cross-tenant negado nas rotas

---

## 8. Variáveis de Ambiente para o App (Local)

```env
# .env.local (NÃO commitar)
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

---

## Riscos / Atenções

1. **NUNCA** commite `.env.local` ou chaves reais
2. **NUNCA** use service_role no client/browser
3. Usuários de teste em projeto de produção? Use projeto **staging/dev** dedicado
4. Emails `@test.local` não existem — `email_confirm: true` resolve
5. Se RLS não funcionar: verifique se policies estão ativas (`pg_policies`) e se JWT contém `sub` = `auth.uid()`
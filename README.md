# White Label Platform — Fundação

Plataforma SaaS White-Label Multi-Tenant (modular monolith).

Modelo: `PLATFORM -> TENANT -> STORE -> RESOURCE`. Invariante absoluta:
**Tenant A jamais lê/altera/exclui/opera recurso do Tenant B.**

## Requisitos

- Bun 1.4+, Node 20+ (tipos), Git
- Supabase local via CLI (`supabase start`) — **somente local nesta fase**

## Instalação

```bash
bun install
cp .env.example .env   # nunca commite .env
```

## Comandos

| Comando | Descrição |
|---|---|
| `bun run dev` | web (Vite + TanStack Start/Router) em :5173 |
| `bun run dev:worker` | worker local (poll) |
| `bun run build` | typecheck + build web + worker |
| `bun run lint` | ESLint (inclui max-lines 300) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | unitários (bun test) |
| `bun run test:integration` | integração |
| `bun run test:db` | **PostgreSQL REAL** (PGlite em-processo por padrão; `TEST_DATABASE_URL` p/ servidor) |
| `bun run test:security` | **isolamento tenant/store — bloqueante p/ produção** |
| `bun run test:e2e` | smoke E2E (sem browser) |
| `bunx playwright test` | E2E com navegador (requer browsers) |

## Arquitetura resumida

```
apps/web      TanStack Start + React (UI -> handler -> use case -> repository -> DB)
apps/worker   jobs assíncronos (webhook, email, mídia, billing, domínios)
packages/*    domínio (tenant, auth, domains, storage, payments, billing, audit...)
supabase/migrations  SQL explícito + FK composta + RLS
tests/{unit,integration,security,e2e}
docs/{architecture,adr,security,runbooks}
```

- Auth: Supabase Auth = identidade; domínio = autorização (`tenant_members`, `store_members`).
- `SUPABASE_SERVICE_ROLE_KEY` somente server-only (`packages/auth/src/server.ts`).
- Storage R2: keys `tenants/{t}/stores/{s}/...` geradas no servidor.
- Pagamentos: adapters (`PaymentProvider`), dinheiro em centavos, 3 níveis isolados.
- Webhooks: autentica -> persiste -> idemptr -> enqueue -> worker -> retry -> DLQ.

Ver `docs/architecture/`, `docs/security/`, `docs/adr/`.

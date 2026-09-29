# Trust boundaries

1. Browser (não confiável) — nenhum UUID concede autorização.
2. Edge/borda — remove headers internos espúrios; única que pode assinar contexto.
3. Server (web/worker) — resolve TenantContext via sessão+membership+domínio.
4. DB — FK composta + RLS como barreira final.

# Tenant isolation

`assertSameTenant/assertSameStore` na app + `FOREIGN KEY (tenant_id, store_id)`
+ RLS por membership. Testes em `tests/security/tenant-isolation` (bloqueantes).

# RLS strategy

Deny-by-default; sem `SET LOCAL` (falsa segurança em HTTP). Políticas usam
`auth.uid()` + `is_tenant_member/is_store_member` (SECURITY DEFINER mínimo,
`search_path=public`, REVOKE/GRANT). Escrita só via service_role server-side.
Catálogo público via endpoint tenant/store-scoped, não via RLS aberta.

# Service role policy

`packages/auth/src/server.ts` é server-only (falha se `window` existir).
Nunca prefixar segredo com `VITE_`. CI pode auditar imports.

# Secrets policy

`.env` nunca commitado; `.env.example` sem segredos; metadata/audit sanitizada
(`[REDACTED]`); sem senha/token em log.

# Threat model inicial

- Cross-tenant via IDOR (mitigado: contexto server + FK + RLS + testes).
- Spoof de tenant via body/header (mitigado: servidor ignora input não confiável).
- Vazamento de service_role/R2 (mitigado: server-only + env separada).
- SSRF futura: URLs externas tratadas como não confiáveis, allowlist + timeout.

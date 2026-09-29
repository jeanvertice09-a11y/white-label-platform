# Visão geral

Modular monolith em Bun + TypeScript + React + TanStack Start.
Postgres/Supabase com SQL explícito (sem ORM pesado). Deploy: Vercel (web/API),
worker separado, Cloudflare (DNS/CDN/WAF, R2, futuro Cloudflare for SaaS).

# Multi-tenancy

`PLATFORM -> TENANT -> STORE -> RESOURCE`. Todo recurso carrega `tenant_id`
(+ `store_id`). Barreiras: `TenantContext` server-side, FK composta no Postgres,
RLS deny-by-default com `auth.uid()` + membership.

# Request flow

`Host -> DomainResolver -> TenantContext -> guard RBAC -> use case -> repository -> DB`.
Rota fina; regra de negócio fora de rota/componente. Zod na borda; SQL parametrizado.

# Payment architecture

`PaymentProvider` (MercadoPago/Asaas futuros). Níveis `platform_billing`,
`tenant_billing`, `store_checkout` com gateway accounts e ledgers isolados.
Dinheiro em centavos. Webhook idempotente (`provider+conta+evento`).

# Storage architecture

Contrato `StorageProvider`; upload presigned futuro; servidor gera
`tenants/{t}/stores/{s}/...`; valida MIME/tamanho; segredos só server-side.

# Domain resolution

PostgreSQL autoritativo; `DomainCache` desacoplado (futuro KV/edge).
Headers internos só valem se a borda remove o externo (fronteira documentada).

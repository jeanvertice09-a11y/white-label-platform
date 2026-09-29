# ADR 004-composite-foreign-keys

UNIQUE(tenant_id,id) em stores + FOREIGN KEY(tenant_id,store_id). Postgres rejeita mistura cross-tenant independente da app.


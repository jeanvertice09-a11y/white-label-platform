# Domínios em desenvolvimento

Sem Cloudflare nesta fase. O `DomainResolver` lê `public.domains`
(PostgresDomainStore, service_role no servidor).

Desenvolvimento local: cadastre hostnames `.localhost` no banco LOCAL, ex.:

```sql
insert into public.domains (tenant_id, hostname, type, status, verification_token, verified_at)
values ('<tenant>', 'tenant-a.localhost', 'tenant_site', 'active', 'dev', now());
```

Acesse `http://tenant-a.localhost:5173`. Normalização (lowercase, sem porta,
sem trailing dot) é idêntica à de produção; nenhum bypass existe —
host não cadastrado/verificado não resolve em nenhum ambiente.

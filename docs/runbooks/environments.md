# Ambientes

- `local`: `supabase start`, R2 fake/contrato, gateways sandbox. `.env` local.
- `staging`: Supabase/R2/gateways próprios de staging, domínios separados.
- `production`: recursos e credenciais exclusivos; gateways produção.

Nunca desenvolver em produção. Cada ambiente tem Supabase, R2, credenciais,
gateways e domínios separados.

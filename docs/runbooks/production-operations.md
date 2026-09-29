# Production operations

Este runbook define o mínimo operacional para produção.

## Deploy gate

A branch de produção deve exigir o job GitHub Actions `foundation`. O job executa install com lockfile congelado, lint sem warnings, typecheck, suites unit/integration/security, banco real em PGlite/Postgres, Playwright/Chromium e build.

Push direto, force-push e deleção da branch principal devem permanecer bloqueados por ruleset/branch protection no GitHub. Mudanças entram por pull request.

## Worker health

O worker usa `SUPABASE_DB_URL` e filas persistentes em `operational_jobs`. A cada incidente verificar, nesta ordem: jobs `dead_letter`, jobs `retry`, leases `running` expirados, idade do job enfileirado mais antigo e falhas recorrentes por `kind`.

Alertar operacionalmente quando existir dead-letter, quando um job running ultrapassar a lease, ou quando a fila mais antiga permanecer além do SLO definido para o ambiente. Nunca remover dead-letter sem registrar a causa e a ação corretiva.

## Backup e restore

Backups do PostgreSQL/Supabase são parte da infraestrutura, não do deploy da aplicação. Produção deve ter backup automático habilitado no provedor. Executar restore drill periódico em ambiente isolado e registrar data, duração, ponto restaurado e validações executadas. Um backup sem restore testado não é considerado evidência de recuperação.

R2 deve possuir política de retenção compatível com o produto. Banco e objetos precisam ser tratados como conjuntos relacionados durante recuperação.

## Smoke pós-deploy

Depois de deploy READY: verificar home/login, guards de master/control/admin, storefront ativo, produto comprável e carrinho. Em homologação, configurar `E2E_STOREFRONT_HOST` e `E2E_PRODUCT_SLUG` para impedir que o smoke real do storefront seja pulado.

Também revisar logs de runtime para erros novos e o painel operacional para webhook/job dead-letter, retries e divergências financeiras.

## Incidente

1. preservar logs, request IDs e audit trail;
2. interromper somente a capacidade afetada quando houver kill-switch/status disponível;
3. não editar migration já aplicada: usar forward-fix;
4. reconciliar pagamentos/webhooks antes de correções manuais de estado;
5. validar isolamento tenant/store em qualquer correção de dados;
6. após recuperação, registrar causa, impacto, correção e teste que evita regressão.

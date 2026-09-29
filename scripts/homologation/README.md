# Homologação Kataluu v1

Massa determinística e removível para validar `/master`, `/control`, `/admin`, storefront, pedidos, estoque, compras, financeiro, marketing e billing.

## Garantias

- Não roda em build, deploy, startup, migration ou worker normal.
- Não cria usuário Supabase Auth.
- Não cria `public.plans` automaticamente.
- Não envia arquivos ao R2.
- Não chama Mercado Pago/Asaas e não cria webhook externo.
- `apply` continua transacional e executa rollback em erro.
- Cleanup continua restrito aos IDs determinísticos HML v1.
- Mídia pode ser explicitamente adiada somente pelo fluxo HML funcional; o fluxo Production completo continua fail-closed para mídia.

## Massa

- 2 White Labels: Aurora Commerce HML e Nexo Varejo HML.
- 4 lojas, 2 `classic` + 2 `modern`.
- 72 produtos, 92 variantes, 48 clientes, 64 pedidos.
- 12 fornecedores, 16 compras, 40 lançamentos financeiros, 24 tarefas.
- 12 cupons, 4 campanhas, 14 invoices e 29 payments internos.
- Readiness completa de mídia: 76 objetos de catálogo (72 imagens + 4 banners) e 2 logos.

## Planos por loja

A homologação usa quatro níveis diferentes e nunca usa `complete_ecommerce` enquanto `online_payments` não estiver end-to-end no storefront:

| White Label | Loja | Template | Layout |
| --- | --- | --- | --- |
| Aurora | Lume Atelier HML | `monthly_entry` | `classic` |
| Aurora | Botânica Lab HML | `monthly_intermediate` | `modern` |
| Nexo | Passo Norte HML | `monthly_complete` | `classic` |
| Nexo | Casa Nativa HML | `complete` | `modern` |

Isso cria quatro `tenant_plans` determinísticos: dois na Aurora e dois na Nexo. Cada `store_subscription` referencia o seu `tenant_plan`, preservando `plan_template -> tenant_plan -> store_subscription`.

Preço, `billingInterval`, `trialEnabled` e `trialDays` vêm somente do config privado. Não existe preço/trial default HML no código. O preflight falha se qualquer campo obrigatório estiver ausente ou incoerente.

Os valores históricos Kataluu -> White Label também vêm de `platformBillingAmountCents`; os antigos R$159/R$189 não são mais uma decisão hardcoded do fixture.

## `public.plans` — Kataluu -> White Label

O seed recebe apenas `platformPlanSlug` e exige que o registro já exista, esteja ativo e tenha `billing_interval`.

Schema relevante atual:

- `slug text unique not null`
- `name text not null`
- `price_cents integer not null check >= 0`
- `currency text not null default 'BRL'`
- `active boolean not null default true`
- `billing_interval text not null check in ('monthly','yearly')`

`scripts/homologation/platform-plan.example.sql` é um template fail-closed para criação manual posterior. Ele não contém preço oficial e aborta enquanto slug/nome/preço/intervalo não forem preenchidos explicitamente.

## Auth — seis usuários externos

Emails operacionais sugeridos no exemplo:

- `hml.aurora@kataluu.com.br` — `tenant_owner` Aurora
- `hml.nexo@kataluu.com.br` — `tenant_owner` Nexo
- `hml.lume@kataluu.com.br` — `store_owner` Lume
- `hml.botanica@kataluu.com.br` — `store_owner` Botânica
- `hml.passo@kataluu.com.br` — `store_owner` Passo Norte
- `hml.casa@kataluu.com.br` — `store_owner` Casa Nativa

Os UUIDs são sempre externos e ficam apenas no arquivo privado. O preflight exige seis UUIDs distintos, confirma todos em `auth.users`, compara os emails e rejeita memberships pré-existentes fora do tenant/store HML esperado.

Nenhuma senha deve ser versionada.

## Domains — 12 hostnames

A arquitetura possui quatro tipos distintos: `tenant_site`, `tenant_panel`, `store_admin`, `store_catalog`.

Hostnames HML previstos:

- `aurora-hml.kataluu.com.br`
- `painel-aurora-hml.kataluu.com.br`
- `gestao-lume-hml.kataluu.com.br`
- `lume-hml.kataluu.com.br`
- `gestao-botanica-hml.kataluu.com.br`
- `botanica-hml.kataluu.com.br`
- `nexo-hml.kataluu.com.br`
- `painel-nexo-hml.kataluu.com.br`
- `gestao-passo-hml.kataluu.com.br`
- `passo-hml.kataluu.com.br`
- `gestao-casa-hml.kataluu.com.br`
- `casa-hml.kataluu.com.br`

A policy continua rejeitando labels reservados: `app`, `www`, `admin`, `control`, `api`, `media`, `assets`, `static`, `auth`, `login`, `support`, `billing`.

O preflight verifica normalização, policy, duplicação no config e colisão de todos os hostnames em `public.domains`. A verificação DNS/controle externo continua responsabilidade operacional antes de definir `HOMOLOGATION_DOMAINS_VERIFIED=true`.

## Config privado

Copie `scripts/homologation/hml-production.example.json` para `scripts/homologation/hml-production.json` e preencha os campos marcados. O arquivo real está no `.gitignore`.

O exemplo não contém senha, DB URL, token, secret ou credencial R2.

## Dois níveis de readiness

A homologação separa explicitamente duas verificações:

1. **Funcional** — banco, planos, Auth, domains, memberships, massa, layouts e isolamento. Mídia pode ficar pendente.
2. **Production completa** — tudo da funcional **mais** manifesto e publicação física de 76 assets + 2 logos.

O modo funcional não cria placeholder e não grava object keys ou URLs de mídia inexistentes. Em `MEDIA DEFERRED`:

- `tenant_branding.logo_url` fica `NULL`;
- não são inseridas linhas em `media_assets`;
- não são inseridas linhas em `product_images`;
- não são inseridas linhas em `store_banners`.

O storefront já trata produtos sem `product_images` com o estado neutro de imagem indisponível e banners vazios simplesmente não são renderizados.

## Manifesto dos 76 assets

Quando a fase de mídia for iniciada, gere/forneça o manifesto real. Cada uma das 76 entradas exige:

- `objectKey` como chave do JSON;
- `source` reproduzível;
- `mimeType`;
- `sizeBytes` real;
- `sha256` de 64 hex;
- `storeKey`;
- `kind` (`product` ou `banner`);
- `productSlug` quando for imagem de produto.

O validator completo rejeita key ausente/extra, associação divergente, size inválido, checksum inválido e conteúdo duplicado por SHA-256.

## R2 e mídia pública

O repo possui contrato R2 e keys server-authoritative, mas não possui provider/uploader R2 concreto reutilizável. O fluxo funcional não tenta upload nem publicação.

No readiness completo, `https://media.kataluu.com.br/<objectKey>` precisa validar:

- 76/76 URLs com sucesso;
- corpo não vazio e size esperado;
- MIME esperado;
- SHA-256 idêntico ao manifesto;
- duas URLs dos logos com conteúdo não vazio.

## Preflight funcional — read-only

Não exige manifesto nem publicação R2:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
bun run homologation:preflight:functional
```

O retorno informa explicitamente `media.mode=deferred`, `media.ready=false` e `media.pending=true`.

## Preflight Production completo — read-only

Continua exigindo mídia física:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
bun run homologation:preflight:production
```

Ele valida também integridade completa do manifesto, 76 objetos e 2 logos publicados.

Nenhum preflight executa cleanup ou inserts da massa.

## Apply funcional — MEDIA DEFERRED

Somente após autorização explícita e depois de Auth/domains/plano passarem no preflight funcional:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1' \
HOMOLOGATION_AUTH_READY='true' \
HOMOLOGATION_DOMAINS_VERIFIED='true' \
HOMOLOGATION_MEDIA_DEFERRED='KATALUU_HML_MEDIA_DEFERRED' \
bun run homologation:apply:functional
```

Esse comando não aceita `HOMOLOGATION_ASSETS_READY` como substituto do acknowledgement explícito de mídia adiada. O resultado registra `media=deferred` e `mediaPending=true`.

## Apply completo — mídia obrigatória

O caminho existente permanece estrito:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1' \
HOMOLOGATION_AUTH_READY='true' \
HOMOLOGATION_DOMAINS_VERIFIED='true' \
HOMOLOGATION_ASSETS_READY='true' \
bun run homologation:apply
```

Ele valida config completo, executa a verificação física dos assets e roda o DB preflight novamente antes da transação.

## Cleanup

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1_CLEANUP' \
bun run homologation:cleanup
```

Remove somente os dois tenant IDs determinísticos HML e o gateway global HML, com a ordem explícita exigida pelas FKs `RESTRICT` da migration 0025. Auth e binários R2 nunca são apagados pelo cleanup.

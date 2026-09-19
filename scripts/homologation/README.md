# Homologação Kataluu v1

Este pacote prepara uma massa funcional, determinística e removível para validar `/master`, `/control`, `/admin`, storefront, pedidos, estoque, compras, financeiro, marketing e billing.

## O que ele não faz

- Não roda no startup nem no deploy.
- Não cria usuário Supabase Auth.
- Não cria plano Kataluu global nem inventa entitlements do template.
- Não envia arquivos ao R2.
- Não chama Mercado Pago/Asaas e não cria webhook assinado.
- Não aplica migration nem altera schema.

## Conteúdo previsto

- 2 White Labels: Aurora Commerce HML e Nexo Varejo HML.
- 4 stores: Lume Atelier HML, Botânica Lab HML, Passo Norte HML e Casa Nativa HML.
- 2 layouts `classic` + 2 layouts `modern`.
- 72 produtos, 92 variantes, 48 clientes, 64 pedidos.
- 12 fornecedores, 16 compras, 40 lançamentos financeiros, 24 tarefas.
- 12 cupons, 4 campanhas, 24 consentimentos e 12 recipients.
- 2 subscriptions `platform_billing`, 4 `store_subscriptions`, 14 invoices e 29 payments internos.
- 76 objetos R2 esperados: 72 imagens de produto + 4 banners. Logos das White Labels são URLs separadas.

## Pré-requisitos externos

Antes de Production, o operador precisa preparar fora do Git:

1. Um registro real e ativo em `public.plans`, com `billing_interval` configurado.
2. Um `plan_template` real com as features exigidas. Limits ausentes representam ausência de teto; se `max_products`, `max_stores` ou `max_storage_bytes` estiverem configurados, o preflight exige capacidade suficiente para a massa.
3. Seis usuários Supabase Auth já criados: 2 tenant owners + 4 store owners. Apenas os UUIDs entram no config local.
4. Doze hostnames controlados e verificados: site/panel de cada White Label e admin/catalog de cada store.
5. Setenta e seis assets já enviados ao R2 nos object keys retornados por `bun run homologation:assets`.
6. Duas URLs HTTPS reais para os logos das White Labels.

## Config local

Crie um JSON fora do repositório e aponte `HOMOLOGATION_CONFIG_FILE` para ele. O formato é:

```json
{
  "platformPlanSlug": "slug-real-em-public-plans",
  "planTemplateCode": "template-real",
  "tenantOwners": {
    "aurora": "uuid-auth",
    "nexo": "uuid-auth"
  },
  "storeOwners": {
    "lume": "uuid-auth",
    "botanica": "uuid-auth",
    "passo": "uuid-auth",
    "casa": "uuid-auth"
  },
  "tenantLogoUrls": {
    "aurora": "https://...",
    "nexo": "https://..."
  },
  "domains": {
    "aurora": {
      "tenantSite": "...",
      "tenantPanel": "...",
      "stores": {
        "lume": { "admin": "...", "catalog": "..." },
        "botanica": { "admin": "...", "catalog": "..." }
      }
    },
    "nexo": {
      "tenantSite": "...",
      "tenantPanel": "...",
      "stores": {
        "passo": { "admin": "...", "catalog": "..." },
        "casa": { "admin": "...", "catalog": "..." }
      }
    }
  },
  "resolvedAssets": {
    "tenants/<tenant>/stores/<store>/banners/home.webp": {
      "mime": "image/webp",
      "sizeBytes": 123456
    }
  },
  "anchorIso": "2026-09-19T12:00:00.000Z"
}
```

`resolvedAssets` deve conter exatamente as 76 chaves do manifesto. O preflight valida chave, MIME e `sizeBytes`, mas não consulta o bucket R2; portanto `HOMOLOGATION_ASSETS_READY=true` continua sendo uma confirmação operacional do operador de que os objetos reais já existem nas chaves informadas.

## Comandos seguros

```bash
bun run homologation:plan
bun run homologation:assets
```

Esses comandos não acessam o banco.

Para validar dependências contra um banco sem escrever a massa:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml.json' \
bun run homologation:preflight
```

O preflight é read-only. Ele valida o plano Kataluu, o template/entitlements, os seis UUIDs em `auth.users`, hostnames e colisões de slugs/IDs determinísticos de tenants/stores/gateway. Ele não executa cleanup nem inserts da massa.

## Apply em Production — somente após autorização explícita

O comando exige quatro confirmações além do config:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml.json' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1' \
HOMOLOGATION_AUTH_READY='true' \
HOMOLOGATION_DOMAINS_VERIFIED='true' \
HOMOLOGATION_ASSETS_READY='true' \
bun run homologation:apply
```

O apply executa preflight primeiro e depois roda cleanup + criação + reconciliações dentro de transação. Se qualquer constraint ou reconciliação falhar, a transação é revertida.

## Rerun e limpeza

Os IDs da massa são estáveis. Rerun remove somente a versão HML v1 e a recria, evitando duplicação.

Para remover a massa posteriormente:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1_CLEANUP' \
bun run homologation:cleanup
```

O cleanup remove somente os dois tenant IDs determinísticos e o gateway global HML. Usuários Auth e binários R2 não são apagados porque são dependências externas; devem ser tratados separadamente pelo operador.
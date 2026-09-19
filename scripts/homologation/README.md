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

## Massa

- 2 White Labels: Aurora Commerce HML e Nexo Varejo HML.
- 4 lojas, 2 `classic` + 2 `modern`.
- 72 produtos, 92 variantes, 48 clientes, 64 pedidos.
- 12 fornecedores, 16 compras, 40 lançamentos financeiros, 24 tarefas.
- 12 cupons, 4 campanhas, 14 invoices e 29 payments internos.
- 76 objetos de catálogo: 72 imagens de produto + 4 banners.
- 2 logos de White Label, publicados separadamente por URL HTTPS.

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

A arquitetura possui quatro tipos distintos: `tenant_site`, `tenant_panel`, `store_admin`, `store_catalog`. O DomainResolver encaminha respectivamente para `/`, `/control`, `/admin` e `/catalog`, então a homologação realmente usa 12 hostnames distintos.

Proposta compatível com a policy atual:

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

## Manifesto dos 76 assets

Gere a estrutura completa:

```bash
bun run homologation:assets > scripts/homologation/hml-assets.json
```

O arquivo real também está no `.gitignore`. Cada uma das 76 entradas exige:

- `objectKey` como chave do JSON;
- `source` reproduzível (`file`, asset gerado especificamente ou fonte licenciada);
- `mimeType`;
- `sizeBytes` real;
- `sha256` de 64 hex;
- `storeKey`;
- `kind` (`product` ou `banner`);
- `productSlug` quando for imagem de produto.

O validator rejeita key ausente/extra, associação divergente, size inválido, checksum inválido e conteúdo duplicado por SHA-256. Isso impede usar a mesma imagem em vários produtos sem perceber.

Os arquivos ainda precisam ser produzidos/adquiridos externamente com origem apropriada. Não baixar imagens comerciais arbitrárias sem licença.

## R2 e mídia pública

O repo possui contrato R2 e keys server-authoritative, mas não possui provider/uploader R2 concreto reutilizável. Por isso este pacote **não inventa uploader** nem novas credenciais/API.

O storefront já usa `https://media.kataluu.com.br/<objectKey>`. O modo Production faz verificação física por esse origin:

- 76/76 URLs precisam responder com sucesso;
- corpo precisa ter size > 0 e exatamente o `sizeBytes` esperado;
- MIME precisa corresponder quando informado pelo origin;
- SHA-256 do corpo precisa ser idêntico ao manifesto;
- as duas URLs dos logos também precisam responder com conteúdo não vazio.

Assim `HOMOLOGATION_ASSETS_READY=true` não é suficiente sozinho: o `apply` executa a verificação física antes de qualquer escrita no banco.

## Preflight

Preflight DB/config, read-only:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
bun run homologation:preflight
```

Preflight Production, ainda read-only, incluindo mídia física:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
bun run homologation:preflight:production
```

Ele valida:

- `public.plans` selecionado;
- quatro templates/entitlements e limits aplicáveis por loja;
- preço/intervalo/trial explícitos;
- seis Auth UUIDs/emails e escopo de memberships;
- slugs/IDs determinísticos de tenants/stores/tenant_plans/gateway;
- 12 hostnames e colisões no banco;
- integridade completa do manifesto;
- no modo Production, 76 objetos + 2 logos fisicamente publicados.

Nenhum preflight executa cleanup ou inserts da massa.

## Apply — somente após autorização explícita

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1' \
HOMOLOGATION_AUTH_READY='true' \
HOMOLOGATION_DOMAINS_VERIFIED='true' \
HOMOLOGATION_ASSETS_READY='true' \
bun run homologation:apply
```

Mesmo com os quatro flags, o apply valida config, executa a verificação física dos assets e roda o DB preflight novamente antes da transação de cleanup + criação + reconciliações.

## Cleanup

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIRM='KATALUU_HML_V1_CLEANUP' \
bun run homologation:cleanup
```

Remove somente os dois tenant IDs determinísticos HML e o gateway global HML, com a ordem explícita exigida pelas FKs `RESTRICT` da migration 0025. Auth e binários R2 nunca são apagados pelo cleanup.

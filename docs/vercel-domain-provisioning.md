# Provisionamento de Project Domains na Vercel

## Objetivo

O Kataluu continua usando `public.domains` como fonte de verdade de tenant/store e o
`DomainResolver` continua aceitando somente registros `active` com `verified_at`.
A Vercel é somente uma etapa de provisionamento de infraestrutura para hostnames
internos controlados pelo Kataluu em `*.kataluu.com.br`.

Cloudflare continua autoritativo para DNS. Esta integração não altera nameservers,
registros Cloudflare, R2, `media.kataluu.com.br` nem a política de verificação DNS
do Kataluu.

## API oficial usada

Documentação consultada em 2026-09-21:

- `GET /v9/projects/{idOrName}/domains/{domain}` — consulta read-only do Project Domain.
- `POST /v10/projects/{idOrName}/domains` — adiciona um hostname ao projeto.

O `POST` oficial retorna erro quando o domínio já está no projeto. Por isso o cliente
Kataluu primeiro consulta o estado e, em uma corrida `400/409`, consulta novamente.
Só considera sucesso idempotente se o `GET` confirmar que o hostname está de fato
associado ao projeto configurado.

A API Domains Registrar (compra/registro de domínios) não é usada.

## Variáveis server-only

Configure no ambiente server-side da aplicação:

```text
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
```

- `VERCEL_API_TOKEN` é obrigatório.
- `VERCEL_PROJECT_ID` é obrigatório e deve preferencialmente ser o ID estável `prj_*`
  do projeto `white-label-platform-web`.
- `VERCEL_TEAM_ID` é opcional na API, mas recomendado quando o projeto pertence a um
  time; prefira o ID estável `team_*`.
- nenhuma variável pode usar `VITE_` ou `NEXT_PUBLIC_`;
- token e IDs não são persistidos em `public.domains`;
- o token nunca é incluído nos logs.

## Boundary de hostname

`normalizeManagedKataluuHostname()` é propositalmente mais estrito que o formulário
administrativo geral. O provisionador aceita somente hostname puro:

- faz trim e lowercase;
- rejeita protocolo;
- rejeita path, query e fragment;
- rejeita porta;
- valida sintaxe de hostname;
- exige subdomínio de `kataluu.com.br`;
- rejeita o apex `kataluu.com.br`;
- reaproveita a policy existente de nomes reservados.

Continuam reservados: `app`, `www`, `admin`, `control`, `api`, `media`, `assets`,
`static`, `auth`, `login`, `support` e `billing`.

Um hostname externo, por exemplo `loja.cliente.com.br`, continua no fluxo DNS atual e
não é enviado por esta integração para a Vercel.

## Fluxo do painel

Para `tenant_site`, `tenant_panel`, `store_admin` e `store_catalog` sob
`*.kataluu.com.br`:

1. RBAC, escopo tenant/store, entitlement e policy existentes são validados.
2. A unicidade no banco é verificada.
3. `ensureProjectDomain(hostname)` reconcilia o Project Domain na Vercel.
4. Somente depois o registro é criado/atualizado como `pending` no Kataluu.
5. A verificação DNS continua passando por `verifyControlDomain`.
6. Somente evidência DNS válida pode escrever `status='active'` e `verified_at`.

A ordem 3 → 4 é intencional: se a API Vercel falhar, um cadastro novo não deixa uma
linha parcialmente criada no banco. Se a Vercel aceitar e a persistência falhar, uma
nova tentativa encontra o Project Domain já existente e continua de forma idempotente.

Editar um hostname gerenciado provisiona o hostname novo antes de alterar o banco.
O hostname antigo não é removido automaticamente da Vercel nesta fase.

Reabrir (`suspended` → `pending`) também reconcilia o Project Domain antes da mudança.

## Idempotência

`ensureProjectDomain()`:

- `GET 200`: retorna `already_provisioned`, sem `POST`;
- `GET 404`: tenta `POST`;
- `POST 200`: retorna `created`;
- `POST 400/409`: executa um novo `GET`;
- se o novo `GET` confirmar o hostname, retorna `already_provisioned`;
- se não confirmar, mantém o erro.

Isso cobre inclusive `lume-hml.kataluu.com.br`, que já pode existir no projeto por
cadastro manual.

## Erros

O cliente retorna erros estruturados:

- `configuration`: token/project ausente;
- `unauthorized`: HTTP 401;
- `forbidden`: HTTP 403;
- `not_found`: recurso inesperadamente ausente;
- `rate_limited`: HTTP 429, com `Retry-After` quando disponível;
- `conflict`: 400/409 não reconciliável;
- `upstream`: 5xx;
- `network`: timeout/falha de rede;
- `unexpected`: demais respostas.

Não há loop automático de retry. Em 429 ou falha transitória, o operador/fluxo pode
tentar novamente depois. O comando de homologação provisiona sequencialmente para
não disparar lote concorrente contra a API.

A documentação pública da Vercel não deve ser transformada em um limite numérico
hardcoded no Kataluu; o código respeita 429 e `Retry-After`.

## Observabilidade

Eventos server-side têm apenas:

- hostname;
- ação `check`/`ensure`;
- resultado;
- status HTTP;
- tipo de erro.

O logger não recebe token nem header `Authorization`.

## Homologação — preview read-only

Depois que o config privado estiver válido:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
VERCEL_API_TOKEN='...' \
VERCEL_PROJECT_ID='prj_...' \
VERCEL_TEAM_ID='team_...' \
bun run homologation:domains:preflight
```

O comando compara os 12 hostnames com:

- escopo esperado em `public.domains`;
- status/`verified_at` do banco;
- presença no Project Domains da Vercel;
- `already_provisioned`, `needs_provisioning` ou erro.

O preflight usa apenas `SELECT` no banco e `GET` na Vercel.

## Homologação — provisionamento explícito

Somente após autorização operacional:

```bash
DATABASE_URL='...' \
HOMOLOGATION_CONFIG_FILE='/caminho/seguro/hml-production.json' \
VERCEL_API_TOKEN='...' \
VERCEL_PROJECT_ID='prj_...' \
VERCEL_TEAM_ID='team_...' \
HOMOLOGATION_DOMAINS_PROVISION_CONFIRM='KATALUU_HML_DOMAINS_V1' \
bun run homologation:domains:provision
```

Antes de qualquer `POST`, o comando exige que todos os 12 hostnames já existam no
banco no tenant/store/type esperado. Em seguida executa `ensureProjectDomain`
sequencialmente. Ele não altera `status`, `verified_at` ou verification token.

## Rollback

Não há remoção automática destrutiva nesta implementação.

Rollback do código:

1. desabilitar/reverter a chamada do provisionador no backend ou remover o token;
2. manter os registros `public.domains` intactos;
3. manter os Project Domains já adicionados na Vercel intactos;
4. se houver necessidade de remoção de infraestrutura, fazer operação separada e
   explicitamente aprovada após revisar o lifecycle do domínio.

Remover um tenant/store no Kataluu não remove Project Domain da Vercel automaticamente.

## Testes

A suíte cobre validação de hostname, zona/reservados, config ausente, criação,
idempotência/race, 401/403, 429, 5xx, rede/timeout, boundary de segredo,
`DomainResolver` fail-closed e preflight HML sem mutação.

Todos os testes de API usam `fetch` mockado. Nenhum gate chama a API real da Vercel.

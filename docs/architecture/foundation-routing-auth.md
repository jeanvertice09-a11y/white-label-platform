# Fundação de autenticação, domínio e contexto

## Fluxo confiável

A autorização dos painéis segue esta ordem:

1. hostname da request;
2. sessão Supabase Auth SSR;
3. resolução do domínio (quando dinâmico) pela tabela `domains`;
4. leitura das memberships do usuário autenticado;
5. construção de `TenantContext` no servidor;
6. RBAC da rota;
7. somente então acesso aos dados do tenant/store.

`tenant_id` e `store_id` enviados por query/body/header do navegador nunca são autoridade de autorização.

## Hosts internos

- `control.geral.kataluu.com.br` → `/master` → exige `platform_owner` ou `platform_admin`.
- `app.kataluu.com.br` → `/control`.
- `kataluu.com.br` e `www.kataluu.com.br` → site público, sem fallback para painel.

## Tipos de domínio dinâmico

A tabela `domains` é a fonte autoritativa.

- `tenant_panel` → `/control`.
- `tenant_site` → site institucional/comercial da White Label; **não** é catálogo.
- `store_admin` → `/admin`.
- `store_catalog` → `/catalog`.

Acessar uma rota protegida em um host de tipo incompatível resulta em 404. Um host desconhecido autenticado também resulta em 404, sem fallback silencioso para `/master`.

## app.kataluu.com.br e múltiplas White Labels

O host de sistema `app.kataluu.com.br` não escolhe um tenant arbitrariamente:

- zero memberships de tenant → `403 TENANT_UNRESOLVED`;
- exatamente uma membership de tenant → usa esse tenant;
- mais de uma membership de tenant → `403 TENANT_SELECTION_REQUIRED`.

`TENANT_SELECTION_REQUIRED` é um contrato arquitetural para uma futura seleção explícita de White Label. Este lote não adiciona UI de seleção e, principalmente, não escolhe o primeiro tenant automaticamente.

## Semântica de erros

- `401 UNAUTHENTICATED`: sessão ausente;
- `403`: sessão válida, mas membership/role insuficiente;
- `404`: host inexistente ou tipo de domínio incompatível com a rota;
- `500`: falha interna de banco/configuração/runtime ou contexto interno inválido.

Erros internos não devem ser reclassificados como 403.

## RLS

A estratégia é deny-by-default para tabelas operacionais acessadas por boundaries server-side. A ausência de policy nessas tabelas é intencional e não deve ser “corrigida” com policies permissivas apenas para remover avisos do advisor.

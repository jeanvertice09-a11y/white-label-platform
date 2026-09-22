# Production readiness — Agente 02

Base obrigatória auditada e usada para iniciar a branch: `2170ea15a35dce6a5e22026bf6c7d6eaca70c8cb`.

Durante o desenvolvimento a `main` avançou para `671f61235ac29fc4a12fbcd48b7bfc8793d25002` com o lote do Agente 01 (MFA/rate limiting/payment hardening). O trabalho abaixo foi reaplicado sobre essa `main` mais nova apenas para preservar o trabalho paralelo e evitar colisão de migration; nenhuma alteração do Agente 01 foi reescrita.

Legenda: **A** = pronto/implementado no escopo atual; **B** = seguro com limitação explícita; **C** = não deve ser habilitado em produção sem trabalho adicional.

## 1. LGPD / exportação — A (STORE) / B (TENANT e PLATFORM em lote)

Foi adicionada exportação JSON da STORE atual. O browser não informa `tenantId` nem `storeId`: o boundary usa o host e a sessão autenticada para resolver `loadStoreAdmin`, exige `store_owner` ou `store_admin` e todas as queries repetem o escopo `tenant_id + store_id`.

Incluídos no pacote da loja: loja, categorias, produtos/variantes, clientes/consumidores cadastrados nessa loja, pedidos/itens, cupons, financeiro interno, fornecedores, compras/itens, tarefas, campanhas/consentimentos, catálogo/banners e um recorte seguro de audit log.

Excluídos deliberadamente: service role, tabelas privadas, credenciais de gateway, ciphertexts, material criptográfico, hashes/tokens, IP, user-agent, metadata livre de auditoria e qualquer dado de outro tenant/store.

A exportação síncrona é limitada a 5.000 registros por dataset e 20.000 registros no total. Se qualquer limite for ultrapassado, a operação falha explicitamente. Volume maior deve usar job durável/arquivo assíncrono; não aumentar limites apenas para contornar serverless.

Exportação bulk de TENANT (várias stores) e PLATFORM não foi implementada de forma síncrona: o volume e a sensibilidade tornam necessário job durável + armazenamento temporário seguro + expiração/auditoria antes de expor essa capacidade. Também não foi criado endpoint público de autoatendimento para consumidor final; pedidos de titular continuam exigindo fluxo administrativo autenticado da loja até existir identidade/autorização própria do consumidor.

## 2. Analytics interno — A

A migration `0028_production_readiness.sql` cria `storefront_analytics_events` com RLS e sem policy pública. Não há PII, IP, user-agent nem payload JSON arbitrário.

O hostname ativo/verificado resolve o tenant/store server-side. Produto e pedido são revalidados no mesmo tenant/store. Em `order_created`, o total vem de `orders`, nunca do valor enviado pelo browser. Se produto/pedido for removido posteriormente, a referência histórica pode virar `NULL` sem impedir a exclusão.

Definições do painel (janela padrão: últimos 30 dias, inclusive):

- **visitas**: sessões distintas com `catalog_view`;
- **produto visto**: quantidade de eventos `product_view`;
- **add-to-cart**: quantidade de eventos `add_to_cart`;
- **checkout iniciado**: sessões distintas com `begin_checkout`;
- **pedidos**: pedidos `whatsapp|online`, não cancelados, criados no período na tabela autoritativa `orders`;
- **conversão**: `pedidos / visitas * 100`, zero quando não há visitas.

Meta Pixel, GA4 e TikTok continuam independentes. Falha do analytics interno não interrompe carrinho/checkout nem o envio dos pixels; ausência de pixel também não desliga a persistência interna.

## 3. Domain resolution / cache — A (correção atual), B (cache futuro)

Produção usa `DomainResolver(createServiceDomainStore())` sem `InMemoryDomainCache`. O store consulta `domains` exigindo `status='active'` e `verified_at is not null`; TenantContext revalida tenant/store e bloqueia suspensão.

Decisão: **não habilitar cache em memória em Vercel/serverless**. O banco permanece autoridade. Nenhuma dependência externa foi adicionada.

Se cache distribuído for introduzido futuramente, ele deve ser compartilhado entre instâncias, usar chave por hostname, TTL curto, invalidação em criação/alteração/suspensão/remoção e nunca permitir que um hit contorne a revalidação de status. Mudança de domínio deve invalidar hostname antigo e novo.

## 4. Feature flags — A

Não foi criado um segundo mecanismo. O projeto já possui entitlements server-authoritative por tenant/store/plano e checks dedicados para catálogo, domínio, inventário, marketing, operações e pedidos. Estados de tenant/store/domain também fornecem kill-switch operacional.

Uma tabela genérica de flags hoje duplicaria autoridade sem caso real adicional. Criar somente quando houver rollout experimental que não possa ser expresso por entitlement/configuração existente.

## 5. Filas / retry / dead-letter — A

O pipeline de webhook de pagamentos já é durável: idempotência por evento externo, claim, `attempts`, `maxAttempts`, backoff, `next_attempt_at`, recuperação de `processing` travado e `dead_letter`. Isso foi preservado.

O worker agora registra `name/message` quando o polling falha e rejeita job kind inesperado, em vez de perder completamente o diagnóstico.

A fila operacional genérica agora é persistente em `operational_jobs`, com idempotência, claim concorrente, lease, stale recovery, retry exponencial, max attempts, dead-letter, isolamento tenant/store e observabilidade. `domain.verify`, `billing.reconcile` e `media.process` possuem handlers reais. `email.send` permanece deliberadamente fail-closed até existir um provider real configurado; nenhum job de e-mail é marcado como enviado sem integração externa.

## 6. Observabilidade operacional — A

`/control` passa a mostrar indicadores vindos do banco para:

- webhook dead-letter;
- webhook em retry;
- webhook em processing há mais de 5 minutos;
- divergência entre status capturado/falhado do payment e `orders.payment_status`;
- domínios suspensos;
- domínios pending sem verificação há mais de 24h.

Nenhum desses números usa fixture ou placeholder.

## 7. Migrations / política — A

Na base obrigatória, o histórico era `0001`…`0016`, `0019`, `0021`…`0026`: `0017`, `0018` e `0020` não existiam. A `0021` documenta que `0020` estava reservado para trabalho paralelo; não há evidência suficiente no código para atribuir motivo a `0017/0018`.

Enquanto este lote estava em desenvolvimento, o Agente 01 integrou `0027_security_rate_limits.sql`. Por isso este lote usa `0028_production_readiness.sql` e não reutiliza/edita `0027`.

Política:

1. migrations aplicadas são imutáveis;
2. número ausente nunca é reutilizado;
3. nova mudança usa o próximo número monotônico disponível;
4. aplicar migrations pelo fluxo versionado/CI, nunca colando SQL manual em produção;
5. em produção, preferir **forward-fix** com nova migration;
6. rollback destrutivo só com plano explícito de dados e janela operacional — não editar uma migration já aplicada.

Este lote adiciona `0028_production_readiness.sql` e inclui `0027` + `0028` no harness de DB. Não há execução manual de Supabase.

## 8. E2E / smoke — B

O gate `tests/e2e/smoke.ts` executa matriz real de guards sem browser. Playwright cobre negação fail-closed de `/master`, `/control`, `/admin`, home pública e `/login`.

Foi adicionado um smoke real `domínio → produto → carrinho → superfície de checkout`. Ele só roda quando `E2E_STOREFRONT_HOST` e `E2E_PRODUCT_SLUG` apontam para uma loja fixture ativa; sem esses dados o teste é explicitamente `skip`, não um falso positivo com mocks.

Para smoke autenticado completo de `/master`, `/control` e `/admin` ainda é necessário ambiente com credenciais/estado autenticado isolado. Para storefront real são necessários hostname `store_catalog`, tenant/store ativos e produto comprável conhecido.

## 9. Readiness para piloto pago — B

Busca por `TODO` no código da base não encontrou pendência indexada, mas a leitura do worker encontrou funcionalidade aparente sem implementação real: os quatro handlers genéricos descritos no bloco 5.

Para o piloto, manter essas capacidades não expostas até implementação durável. O fluxo de pagamento/webhook existente deve continuar sendo o único caminho de worker considerado operacional.

Itens do domínio do Agente 01 (MFA, rate limiting, hardening de pagamentos, cross-gateway-account, webhook security e refund) não foram alterados por este lote; a integração mais nova da `main` foi apenas preservada.

## Critérios operacionais antes do piloto

- aplicar `0028` pelo pipeline normal;
- CI verde em install/lint/typecheck/testes DB/security/build;
- verificar `/control` sem dead-letter/stale/inconsistências não explicadas;
- executar Playwright com `E2E_STOREFRONT_HOST` e `E2E_PRODUCT_SLUG` em homologação;
- manter jobs genéricos stub desabilitados/não prometidos até implementação;
- para exportações >5.000 linhas/dataset ou >20.000 linhas totais, implementar job assíncrono antes de liberar o volume.

# ADR 009 — Worker boundary e jobs duráveis

O worker separado é a fronteira para trabalho assíncrono. Web/API não considera uma operação assíncrona concluída apenas por ter criado um job.

## Filas

- Webhooks de pagamento mantêm a fila especializada `webhook_events`, com idempotência do provedor.
- Trabalho operacional usa `operational_jobs`: `domain.verify`, `billing.reconcile`, `media.process` e, futuramente, `email.send`.
- `operational_jobs` é server-only: RLS habilitada e nenhuma policy de browser.
- Escopo de store é protegido por FK composta `tenant_id + store_id`.
- `kind + idempotency_key` impede enqueue duplicado.

## Execução

O worker faz claim concorrente com `FOR UPDATE SKIP LOCKED`, cria lease, incrementa attempts, recupera lease vencida, aplica exponential backoff e termina em dead-letter ao esgotar `max_attempts`.

Todo handler revalida no banco o tenant/store do recurso antes de efeitos externos. Jobs nunca confiam em escopo vindo do browser.

## Capacidades

- `domain.verify`: consulta DNS CNAME+TXT e ativa o domínio somente se o desafio atual ainda corresponder.
- `billing.reconcile`: busca o estado no provider usando a credencial server-side do gateway e reutiliza a máquina de estados de pagamentos.
- `media.process`: remove mídia órfã/expirada via R2 após claim atômico no banco.
- `email.send`: permanece fail-closed até existir provider real. A fila pode representar a capacidade, mas ausência de provider nunca vira “enviado”.

## Operação

Retry, dead-letter e lease vencida aparecem no painel Control. Administradores da White Label podem reenfileirar dead-letters do próprio tenant; a mutation deriva tenant e ator da sessão/host e audita a recuperação. Falha de um subsistema não interrompe o polling de webhooks de pagamento.

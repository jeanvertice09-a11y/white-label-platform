import type { MerchantOpsSqlExecutor } from "./repository.ts";
import type { MerchantScope, MerchantTask, MerchantTaskInput } from "./types.ts";
import { assertScope, mapTask, nullable } from "./postgres-common.ts";

function assertTask(input: MerchantTaskInput): void {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 180) throw new Error("Título da tarefa inválido");
  if ((input.description?.trim().length ?? 0) > 4000) throw new Error("Descrição da tarefa inválida");
  if (!(["low", "normal", "high"] as const).includes(input.priority)) throw new Error("Prioridade inválida");
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) throw new Error("Vencimento da tarefa inválido");
}

export async function listTasks(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
): Promise<MerchantTask[]> {
  assertScope(scope);
  const rows = await sql.query(
    `select * from public.merchant_tasks
     where tenant_id=$1 and store_id=$2
     order by (status='open') desc,
       case priority when 'high' then 0 when 'normal' then 1 else 2 end,
       due_at nulls last,created_at desc`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapTask);
}

export async function createTask(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  input: MerchantTaskInput,
  actorId: string,
): Promise<MerchantTask> {
  assertScope(scope);
  assertTask(input);
  const rows = await sql.query(
    `insert into public.merchant_tasks (
       tenant_id,store_id,title,description,priority,due_at,assignee_user_id,created_by
     ) values ($1,$2,$3,$4,$5,$6::timestamptz,$7::uuid,$8::uuid)
     returning *`,
    [
      scope.tenantId,
      scope.storeId,
      input.title.trim(),
      nullable(input.description),
      input.priority,
      input.dueAt ?? null,
      input.assigneeUserId ?? null,
      actorId,
    ],
  );
  if (!rows[0]) throw new Error("Falha ao criar tarefa");
  return mapTask(rows[0]);
}

export async function completeTask(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  taskId: string,
): Promise<MerchantTask> {
  assertScope(scope);
  const rows = await sql.query(
    `update public.merchant_tasks
     set status='done',completed_at=now(),updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid and status='open'
     returning *`,
    [scope.tenantId, scope.storeId, taskId],
  );
  if (rows[0]) return mapTask(rows[0]);
  const current = await sql.query(
    `select * from public.merchant_tasks
     where tenant_id=$1 and store_id=$2 and id=$3::uuid`,
    [scope.tenantId, scope.storeId, taskId],
  );
  if (!current[0]) throw new Error("Tarefa não encontrada");
  return mapTask(current[0]);
}

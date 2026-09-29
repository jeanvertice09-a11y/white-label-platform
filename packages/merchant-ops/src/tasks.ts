import type { MerchantOpsSqlExecutor } from "./repository.ts";
import type { MerchantScope, MerchantTask, MerchantTaskInput, MerchantTaskStatus } from "./types.ts";
import { assertScope, mapTask, nullable } from "./postgres-common.ts";

function assertTask(input: MerchantTaskInput): void {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 180) throw new Error("Título da tarefa inválido");
  if ((input.description?.trim().length ?? 0) > 4000) throw new Error("Descrição da tarefa inválida");
  if (!(["low", "normal", "high"] as const).includes(input.priority)) throw new Error("Prioridade inválida");
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) throw new Error("Vencimento da tarefa inválido");
}

function taskValues(input: MerchantTaskInput): unknown[] {
  return [input.title.trim(), nullable(input.description), input.priority, input.dueAt ?? null, input.assigneeUserId ?? null];
}

export async function listTasks(sql: MerchantOpsSqlExecutor, scope: MerchantScope): Promise<MerchantTask[]> {
  assertScope(scope);
  const rows = await sql.query(
    `select * from public.merchant_tasks where tenant_id=$1 and store_id=$2
     order by (status='open') desc,case priority when 'high' then 0 when 'normal' then 1 else 2 end,due_at nulls last,created_at desc`,
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
  assertScope(scope); assertTask(input);
  const rows = await sql.query(
    `insert into public.merchant_tasks
      (tenant_id,store_id,title,description,priority,due_at,assignee_user_id,created_by)
     values ($1,$2,$3,$4,$5,$6::timestamptz,$7::uuid,$8::uuid) returning *`,
    [scope.tenantId, scope.storeId, ...taskValues(input), actorId],
  );
  if (!rows[0]) throw new Error("Falha ao criar tarefa");
  return mapTask(rows[0]);
}

export async function updateTask(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  taskId: string,
  input: MerchantTaskInput,
): Promise<MerchantTask> {
  assertScope(scope); assertTask(input);
  const rows = await sql.query(
    `update public.merchant_tasks set
       title=$4,description=$5,priority=$6,due_at=$7::timestamptz,assignee_user_id=$8::uuid,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid returning *`,
    [scope.tenantId, scope.storeId, taskId, ...taskValues(input)],
  );
  if (!rows[0]) throw new Error("Tarefa não encontrada");
  return mapTask(rows[0]);
}

export async function setTaskStatus(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  taskId: string,
  status: MerchantTaskStatus,
): Promise<MerchantTask> {
  assertScope(scope);
  const rows = await sql.query(
    `update public.merchant_tasks set
       status=$4,completed_at=case when $4='done' then coalesce(completed_at,now()) else null end,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid returning *`,
    [scope.tenantId, scope.storeId, taskId, status],
  );
  if (!rows[0]) throw new Error("Tarefa não encontrada");
  return mapTask(rows[0]);
}

export async function completeTask(sql: MerchantOpsSqlExecutor, scope: MerchantScope, taskId: string): Promise<MerchantTask> {
  return setTaskStatus(sql, scope, taskId, "done");
}

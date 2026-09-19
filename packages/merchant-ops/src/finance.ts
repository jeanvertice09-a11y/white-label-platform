import type { MerchantOpsSqlExecutor } from "./repository.ts";
import type {
  FinanceQuery,
  FinanceSummary,
  FinancialCategory,
  FinancialCategoryInput,
  FinancialEntry,
  FinancialEntryInput,
  MerchantScope,
  Page,
} from "./types.ts";
import { assertPage, assertScope, integer, mapCategory, mapFinancialEntry, nullable, text } from "./postgres-common.ts";

function assertDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} inválida`);
}

function assertCategory(input: FinancialCategoryInput): void {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) throw new Error("Nome da categoria financeira inválido");
  if (!(["income", "expense", "both"] as const).includes(input.direction)) {
    throw new Error("Direção da categoria financeira inválida");
  }
}

function assertEntry(input: FinancialEntryInput): void {
  if (!(["receivable", "payable"] as const).includes(input.direction)) throw new Error("Tipo financeiro inválido");
  const description = input.description.trim();
  if (description.length < 2 || description.length > 240) throw new Error("Descrição financeira inválida");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Valor financeiro inválido");
  assertDate(input.dueAt, "Data de vencimento");
  assertDate(input.competenceDate, "Data de competência");
  if ((input.notes?.trim().length ?? 0) > 4000) throw new Error("Observação financeira inválida");
  if (input.direction === "receivable" && (input.supplierId || input.purchaseId)) {
    throw new Error("Conta a receber não pode ser vinculada a fornecedor/compra");
  }
  if (input.direction === "payable" && (input.customerId || input.orderId)) {
    throw new Error("Conta a pagar não pode ser vinculada a cliente/pedido");
  }
}

export async function listFinancialCategories(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
): Promise<FinancialCategory[]> {
  assertScope(scope);
  const rows = await sql.query(
    `select * from public.merchant_financial_categories
     where tenant_id=$1 and store_id=$2
     order by active desc,name asc,id asc`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapCategory);
}

export async function createFinancialCategory(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  input: FinancialCategoryInput,
): Promise<FinancialCategory> {
  assertScope(scope);
  assertCategory(input);
  const rows = await sql.query(
    `insert into public.merchant_financial_categories (tenant_id,store_id,name,direction)
     values ($1,$2,$3,$4)
     returning *`,
    [scope.tenantId, scope.storeId, input.name.trim(), input.direction],
  );
  if (!rows[0]) throw new Error("Falha ao criar categoria financeira");
  return mapCategory(rows[0]);
}

export async function listFinance(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  query: FinanceQuery,
): Promise<Page<FinancialEntry>> {
  assertScope(scope);
  assertPage(query.page, query.pageSize);
  if (query.from) assertDate(query.from, "Data inicial");
  if (query.to) assertDate(query.to, "Data final");
  const rows = await sql.query(
    `select e.*,c.name as category_name,count(*) over()::integer as total_count
     from public.merchant_financial_entries e
     left join public.merchant_financial_categories c
       on c.tenant_id=e.tenant_id and c.store_id=e.store_id and c.id=e.category_id
     where e.tenant_id=$1 and e.store_id=$2
       and ($3::text is null or e.direction=$3)
       and ($4::text is null or e.status=$4)
       and ($5::date is null or e.due_at >= $5::date)
       and ($6::date is null or e.due_at <= $6::date)
       and ($7::text is null
         or e.description ilike '%' || $7 || '%'
         or coalesce(c.name,'') ilike '%' || $7 || '%'
         or coalesce(e.notes,'') ilike '%' || $7 || '%')
     order by e.due_at desc,e.created_at desc,e.id desc
     limit $8 offset $9`,
    [
      scope.tenantId,
      scope.storeId,
      query.direction ?? null,
      query.status ?? null,
      query.from ?? null,
      query.to ?? null,
      query.search?.trim() || null,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    ],
  );
  return {
    items: rows.map(mapFinancialEntry),
    page: query.page,
    pageSize: query.pageSize,
    total: rows.length ? integer(rows[0], "total_count") : 0,
  };
}

export async function createFinancialEntry(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  input: FinancialEntryInput,
  actorId: string,
): Promise<FinancialEntry> {
  assertScope(scope);
  assertEntry(input);
  const neededDirection = input.direction === "receivable" ? "income" : "expense";
  const rows = await sql.query(
    `with category_ok as (
       select $3::uuid is null or exists (
         select 1 from public.merchant_financial_categories c
         where c.tenant_id=$1 and c.store_id=$2 and c.id=$3::uuid
           and c.active=true and c.direction in ($14,'both')
       ) as ok
     )
     insert into public.merchant_financial_entries (
       tenant_id,store_id,direction,category_id,description,amount_cents,
       due_at,competence_date,status,supplier_id,customer_id,order_id,purchase_id,notes,created_by
     )
     select $1,$2,$4,$3::uuid,$5,$6::bigint,$7::date,$8::date,'open',
            $9::uuid,$10::uuid,$11::uuid,$12::uuid,$13,$15::uuid
     from category_ok where ok
     returning *,null::text as category_name`,
    [
      scope.tenantId,
      scope.storeId,
      input.categoryId,
      input.direction,
      input.description.trim(),
      input.amountCents,
      input.dueAt,
      input.competenceDate,
      input.supplierId ?? null,
      input.customerId ?? null,
      input.orderId ?? null,
      input.purchaseId ?? null,
      nullable(input.notes),
      neededDirection,
      actorId,
    ],
  );
  if (!rows[0]) throw new Error("Categoria financeira inválida para este lançamento");
  const created = mapFinancialEntry(rows[0]);
  if (!created.categoryId) return created;
  const category = await sql.query(
    `select name from public.merchant_financial_categories
     where tenant_id=$1 and store_id=$2 and id=$3::uuid`,
    [scope.tenantId, scope.storeId, created.categoryId],
  );
  return { ...created, categoryName: category[0] ? text(category[0], "name") : null };
}

async function loadEntry(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  entryId: string,
): Promise<FinancialEntry> {
  const rows = await sql.query(
    `select e.*,c.name as category_name
     from public.merchant_financial_entries e
     left join public.merchant_financial_categories c
       on c.tenant_id=e.tenant_id and c.store_id=e.store_id and c.id=e.category_id
     where e.tenant_id=$1 and e.store_id=$2 and e.id=$3::uuid`,
    [scope.tenantId, scope.storeId, entryId],
  );
  if (!rows[0]) throw new Error("Lançamento financeiro não encontrado");
  return mapFinancialEntry(rows[0]);
}

export async function settleFinancialEntry(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  entryId: string,
  settledAt: string,
): Promise<FinancialEntry> {
  assertScope(scope);
  const rows = await sql.query(
    `update public.merchant_financial_entries
     set status='settled',settled_at=$4::timestamptz,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid and status='open'
     returning id`,
    [scope.tenantId, scope.storeId, entryId, settledAt],
  );
  if (!rows[0]) {
    const current = await loadEntry(sql, scope, entryId);
    if (current.status === "cancelled") throw new Error("Lançamento cancelado não pode ser liquidado");
    return current;
  }
  return loadEntry(sql, scope, entryId);
}

export async function cancelFinancialEntry(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  entryId: string,
): Promise<FinancialEntry> {
  assertScope(scope);
  const rows = await sql.query(
    `update public.merchant_financial_entries
     set status='cancelled',settled_at=null,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid and status='open'
     returning id`,
    [scope.tenantId, scope.storeId, entryId],
  );
  if (!rows[0]) {
    const current = await loadEntry(sql, scope, entryId);
    if (current.status === "settled") throw new Error("Lançamento liquidado não pode ser cancelado diretamente");
    return current;
  }
  return loadEntry(sql, scope, entryId);
}

export async function summarizeFinance(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  from: string,
  to: string,
): Promise<FinanceSummary> {
  assertScope(scope);
  assertDate(from, "Data inicial");
  assertDate(to, "Data final");
  const rows = await sql.query(
    `select
       coalesce(sum(amount_cents) filter (where direction='receivable' and status='open'),0)::bigint as open_receivable,
       coalesce(sum(amount_cents) filter (where direction='receivable' and status='open' and due_at < current_date),0)::bigint as overdue_receivable,
       coalesce(sum(amount_cents) filter (where direction='payable' and status='open'),0)::bigint as open_payable,
       coalesce(sum(amount_cents) filter (where direction='payable' and status='open' and due_at < current_date),0)::bigint as overdue_payable,
       coalesce(sum(amount_cents) filter (
         where direction='receivable' and status='settled' and settled_at::date between $3::date and $4::date
       ),0)::bigint as received,
       coalesce(sum(amount_cents) filter (
         where direction='payable' and status='settled' and settled_at::date between $3::date and $4::date
       ),0)::bigint as paid,
       coalesce(sum(amount_cents) filter (
         where direction='receivable' and status<>'cancelled' and competence_date between $3::date and $4::date
       ),0)::bigint as competence_receivable,
       coalesce(sum(amount_cents) filter (
         where direction='payable' and status<>'cancelled' and competence_date between $3::date and $4::date
       ),0)::bigint as competence_payable
     from public.merchant_financial_entries
     where tenant_id=$1 and store_id=$2`,
    [scope.tenantId, scope.storeId, from, to],
  );
  const row = rows[0] ?? {};
  const receivedCents = integer(row, "received");
  const paidCents = integer(row, "paid");
  const competenceReceivableCents = integer(row, "competence_receivable");
  const competencePayableCents = integer(row, "competence_payable");
  return {
    openReceivableCents: integer(row, "open_receivable"),
    overdueReceivableCents: integer(row, "overdue_receivable"),
    openPayableCents: integer(row, "open_payable"),
    overduePayableCents: integer(row, "overdue_payable"),
    receivedCents,
    paidCents,
    cashFlowCents: receivedCents - paidCents,
    competenceReceivableCents,
    competencePayableCents,
    managerialResultCents: competenceReceivableCents - competencePayableCents,
  };
}

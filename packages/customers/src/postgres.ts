import {
  mapCustomer,
  mapCustomerOrder,
  withCustomerStats,
} from "./mapper.ts";
import {
  assertCustomerScope,
  normalizeCustomerInput,
} from "./validation.ts";
import type {
  CustomerRepository,
  CustomerSqlExecutor,
} from "./repository.ts";
import type {
  Customer,
  CustomerDetail,
  CustomerMutationInput,
  CustomerScope,
} from "./types.ts";

const CUSTOMER_COLUMNS =
  "id,tenant_id,store_id,name,phone,email,document,birth_date,notes,created_at,updated_at";

async function list(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  search: string,
  limit: number,
): Promise<Customer[]> {
  assertCustomerScope(scope);
  const term = search.trim();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await sql.query(
    `select ${CUSTOMER_COLUMNS} from public.customers
     where tenant_id=$1 and store_id=$2
       and ($3='' or name ilike '%'||$3||'%' or coalesce(phone,'') like '%'||$3||'%'
         or coalesce(email,'') ilike '%'||$3||'%')
     order by name limit $4`,
    [scope.tenantId, scope.storeId, term, safeLimit],
  );
  return rows.map(mapCustomer);
}

async function getById(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  id: string,
): Promise<CustomerDetail | null> {
  assertCustomerScope(scope);
  const rows = await sql.query(
    `select c.*,
       count(o.id) filter (where o.status='completed')::integer as order_count,
       coalesce(sum(o.total_cents) filter (
         where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
       ),0)::bigint as total_spent_cents,
       max(o.created_at) filter (where o.status='completed') as last_purchase_at
     from public.customers c
     left join public.orders o
       on o.tenant_id=c.tenant_id and o.store_id=c.store_id and o.customer_id=c.id
     where c.tenant_id=$1 and c.store_id=$2 and c.id=$3
     group by c.id,c.tenant_id,c.store_id`,
    [scope.tenantId, scope.storeId, id],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const orderRows = await sql.query(
    `select id,order_number,total_cents,status,created_at from public.orders
     where tenant_id=$1 and store_id=$2 and customer_id=$3
     order by created_at desc limit 50`,
    [scope.tenantId, scope.storeId, id],
  );
  return withCustomerStats(mapCustomer(row), row, orderRows.map(mapCustomerOrder));
}

async function create(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  raw: CustomerMutationInput,
): Promise<Customer> {
  assertCustomerScope(scope);
  const input = normalizeCustomerInput(raw);
  const rows = await sql.query(
    `insert into public.customers
      (tenant_id,store_id,name,phone,email,document,birth_date,notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning ${CUSTOMER_COLUMNS}`,
    [
      scope.tenantId, scope.storeId, input.name, input.phone, input.email,
      input.document, input.birthDate, input.notes,
    ],
  );
  if (rows.length === 0) throw new Error("Falha ao criar cliente");
  return mapCustomer(rows[0]);
}

async function update(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  id: string,
  raw: CustomerMutationInput,
): Promise<Customer | null> {
  assertCustomerScope(scope);
  const input = normalizeCustomerInput(raw);
  const rows = await sql.query(
    `update public.customers set
       name=$4,phone=$5,email=$6,document=$7,birth_date=$8,notes=$9,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3
     returning ${CUSTOMER_COLUMNS}`,
    [
      scope.tenantId, scope.storeId, id, input.name, input.phone, input.email,
      input.document, input.birthDate, input.notes,
    ],
  );
  return rows.length ? mapCustomer(rows[0]) : null;
}

export function createCustomerRepository(
  sql: CustomerSqlExecutor,
): CustomerRepository {
  return {
    list: (scope, search, limit) => list(sql, scope, search, limit),
    getById: (scope, id) => getById(sql, scope, id),
    create: (scope, input) => create(sql, scope, input),
    update: (scope, id, input) => update(sql, scope, id, input),
  };
}

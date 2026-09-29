import {
  mapCustomer,
  mapCustomerListItem,
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
  CustomerListQuery,
  CustomerMutationInput,
  CustomerPage,
  CustomerScope,
} from "./types.ts";

const CUSTOMER_COLUMNS =
  "id,tenant_id,store_id,name,phone,email,document,birth_date,notes,created_at,updated_at";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function pageNumber(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function pageSize(value: number): number {
  return Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

async function listPage(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  query: CustomerListQuery,
): Promise<CustomerPage> {
  assertCustomerScope(scope);
  const page = pageNumber(query.page);
  const size = pageSize(query.pageSize);
  const search = query.search?.trim() || null;
  const rows = await sql.query(
    `select c.*,
       count(o.id)::integer as total_orders,
       coalesce(sum(o.total_cents) filter (
         where o.status='completed'
           and o.payment_status not in ('failed','refunded','cancelled')
       ),0)::bigint as total_spent_cents,
       max(o.created_at) as last_order_at,
       count(*) over()::integer as total_count
     from public.customers c
     left join public.orders o
       on o.tenant_id=c.tenant_id and o.store_id=c.store_id and o.customer_id=c.id
     where c.tenant_id=$1 and c.store_id=$2
       and ($3::text is null
         or c.name ilike '%'||$3||'%'
         or coalesce(c.phone,'') like '%'||$3||'%'
         or coalesce(c.email,'') ilike '%'||$3||'%'
         or coalesce(c.document,'') ilike '%'||$3||'%')
     group by c.id,c.tenant_id,c.store_id
     order by max(o.created_at) desc nulls last,c.created_at desc,c.id desc
     limit $4 offset $5`,
    [scope.tenantId, scope.storeId, search, size, (page - 1) * size],
  );
  return {
    items: rows.map(mapCustomerListItem),
    page,
    pageSize: size,
    total: rows.length ? Number(rows[0]?.["total_count"] ?? 0) : 0,
  };
}

async function list(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  search: string,
  limit: number,
): Promise<Customer[]> {
  const page = await listPage(sql, scope, {
    page: 1,
    pageSize: Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE),
    search,
  });
  return page.items;
}

async function getById(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  id: string,
): Promise<CustomerDetail | null> {
  assertCustomerScope(scope);
  const rows = await sql.query(
    `select c.*,
       count(o.id)::integer as total_orders,
       count(o.id) filter (
         where o.status='completed'
           and o.payment_status not in ('failed','refunded','cancelled')
       )::integer as order_count,
       coalesce(sum(o.total_cents) filter (
         where o.status='completed'
           and o.payment_status not in ('failed','refunded','cancelled')
       ),0)::bigint as total_spent_cents,
       max(o.created_at) as last_order_at,
       max(o.created_at) filter (
         where o.status='completed'
           and o.payment_status not in ('failed','refunded','cancelled')
       ) as last_purchase_at
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
    `select o.id,o.order_number,o.total_cents,o.status,o.payment_status,o.created_at,
       count(oi.id)::integer as item_count,
       nullif(string_agg(
         oi.product_name ||
         case when oi.variant_name is null then '' else ' · '||oi.variant_name end,
         ', ' order by oi.id
       ),'') as item_summary
     from public.orders o
     left join public.order_items oi
       on oi.tenant_id=o.tenant_id and oi.store_id=o.store_id and oi.order_id=o.id
     where o.tenant_id=$1 and o.store_id=$2 and o.customer_id=$3
     group by o.id,o.order_number,o.total_cents,o.status,o.payment_status,o.created_at
     order by o.created_at desc,o.id desc limit 50`,
    [scope.tenantId, scope.storeId, id],
  );
  return withCustomerStats(
    mapCustomer(row),
    row,
    orderRows.map(mapCustomerOrder),
  );
}

async function create(
  sql: CustomerSqlExecutor,
  scope: CustomerScope,
  raw: CustomerMutationInput,
  actorUserId: string | null = null,
): Promise<Customer> {
  assertCustomerScope(scope);
  const input = normalizeCustomerInput(raw);
  const rows = await sql.query(
    `with inserted as (
       insert into public.customers
         (tenant_id,store_id,name,phone,email,document,birth_date,notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning ${CUSTOMER_COLUMNS}
     ), audit as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $9::uuid,$1::uuid,$2::uuid,'customer.created','customer',i.id::text,
         jsonb_build_object('source','admin')
       from inserted i where $9::uuid is not null
       returning id
     )
     select * from inserted`,
    [
      scope.tenantId, scope.storeId, input.name, input.phone, input.email,
      input.document, input.birthDate, input.notes, actorUserId,
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
  actorUserId: string | null = null,
): Promise<Customer | null> {
  assertCustomerScope(scope);
  const input = normalizeCustomerInput(raw);
  const rows = await sql.query(
    `with updated as (
       update public.customers set
         name=$4,phone=$5,email=$6,document=$7,birth_date=$8,notes=$9,updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3
       returning ${CUSTOMER_COLUMNS}
     ), audit as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $10::uuid,$1::uuid,$2::uuid,'customer.updated','customer',u.id::text,
         jsonb_build_object('source','admin')
       from updated u where $10::uuid is not null
       returning id
     )
     select * from updated`,
    [
      scope.tenantId, scope.storeId, id, input.name, input.phone, input.email,
      input.document, input.birthDate, input.notes, actorUserId,
    ],
  );
  return rows.length ? mapCustomer(rows[0]) : null;
}

export function createCustomerRepository(
  sql: CustomerSqlExecutor,
): CustomerRepository {
  return {
    list: (scope, search, limit) => list(sql, scope, search, limit),
    listPage: (scope, query) => listPage(sql, scope, query),
    getById: (scope, id) => getById(sql, scope, id),
    create: (scope, input, actorUserId) => create(sql, scope, input, actorUserId),
    update: (scope, id, input, actorUserId) =>
      update(sql, scope, id, input, actorUserId),
  };
}

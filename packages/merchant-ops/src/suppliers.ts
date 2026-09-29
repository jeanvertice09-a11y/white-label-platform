import type { MerchantOpsSqlExecutor } from "./repository.ts";
import type { MerchantScope, Page, PageQuery, Supplier, SupplierInput, SupplierStatus } from "./types.ts";
import { assertPage, assertScope, integer, mapSupplier, nullable } from "./postgres-common.ts";

function assertSupplier(input: SupplierInput): void {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 180) throw new Error("Nome do fornecedor inválido");
  if ((input.email?.trim().length ?? 0) > 254) throw new Error("E-mail do fornecedor inválido");
  if ((input.notes?.trim().length ?? 0) > 2000) throw new Error("Observação do fornecedor inválida");
}

function values(input: SupplierInput): unknown[] {
  return [
    input.name.trim(), nullable(input.tradeName), nullable(input.document), nullable(input.contactName),
    nullable(input.phone), nullable(input.whatsapp), nullable(input.email)?.toLowerCase() ?? null,
    nullable(input.address), nullable(input.notes),
  ];
}

export async function listSuppliers(sql: MerchantOpsSqlExecutor, scope: MerchantScope, query: PageQuery): Promise<Page<Supplier>> {
  assertScope(scope); assertPage(query.page, query.pageSize);
  const search = query.search?.trim() || null;
  const rows = await sql.query(
    `select s.*,
       coalesce(stats.received_purchases,0)::integer as received_purchases,
       coalesce(stats.received_total_cents,0)::bigint as received_total_cents,
       stats.last_received_purchase_at,
       count(*) over()::integer as total_count
     from public.merchant_suppliers s
     left join lateral (
       select
         count(*)::integer as received_purchases,
         coalesce(sum(p.total_cents),0)::bigint as received_total_cents,
         max(p.purchased_at)::text as last_received_purchase_at
       from public.merchant_purchases p
       where p.tenant_id=s.tenant_id and p.store_id=s.store_id
         and p.supplier_id=s.id and p.status='received'
     ) stats on true
     where s.tenant_id=$1 and s.store_id=$2
       and ($3::text is null or s.name ilike '%' || $3 || '%' or coalesce(s.trade_name,'') ilike '%' || $3 || '%'
         or coalesce(s.document,'') ilike '%' || $3 || '%' or coalesce(s.email,'') ilike '%' || $3 || '%')
     order by (s.status='active') desc,s.name asc,s.id asc limit $4 offset $5`,
    [scope.tenantId, scope.storeId, search, query.pageSize, (query.page - 1) * query.pageSize],
  );
  return { items: rows.map(mapSupplier), page: query.page, pageSize: query.pageSize, total: rows.length ? integer(rows[0], "total_count") : 0 };
}

export async function createSupplier(sql: MerchantOpsSqlExecutor, scope: MerchantScope, input: SupplierInput): Promise<Supplier> {
  assertScope(scope); assertSupplier(input);
  const rows = await sql.query(
    `insert into public.merchant_suppliers
      (tenant_id,store_id,name,trade_name,document,contact_name,phone,whatsapp,email,address,notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *,0::integer as received_purchases,0::bigint as received_total_cents,null::text as last_received_purchase_at`,
    [scope.tenantId, scope.storeId, ...values(input)],
  );
  if (!rows[0]) throw new Error("Falha ao cadastrar fornecedor");
  return mapSupplier(rows[0]);
}

export async function updateSupplier(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  supplierId: string,
  input: SupplierInput,
): Promise<Supplier> {
  assertScope(scope); assertSupplier(input);
  const rows = await sql.query(
    `update public.merchant_suppliers set
       name=$4,trade_name=$5,document=$6,contact_name=$7,phone=$8,whatsapp=$9,email=$10,address=$11,notes=$12,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid returning *,0::integer as received_purchases,0::bigint as received_total_cents,null::text as last_received_purchase_at`,
    [scope.tenantId, scope.storeId, supplierId, ...values(input)],
  );
  if (!rows[0]) throw new Error("Fornecedor não encontrado");
  return mapSupplier(rows[0]);
}

export async function updateSupplierStatus(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  supplierId: string,
  status: SupplierStatus,
): Promise<Supplier> {
  assertScope(scope);
  const rows = await sql.query(
    `update public.merchant_suppliers set status=$4,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid returning *,0::integer as received_purchases,0::bigint as received_total_cents,null::text as last_received_purchase_at`,
    [scope.tenantId, scope.storeId, supplierId, status],
  );
  if (!rows[0]) throw new Error("Fornecedor não encontrado");
  return mapSupplier(rows[0]);
}

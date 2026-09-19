import type { MerchantOpsSqlExecutor } from "./repository.ts";
import type { MerchantScope, Page, PageQuery, Purchase, PurchaseInput, PurchaseItem } from "./types.ts";
import { assertPage, assertScope, integer, mapPurchase, mapPurchaseItem, nullable, text } from "./postgres-common.ts";

function assertMoney(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} inválido`);
}

function assertPurchase(input: PurchaseInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.purchasedAt)) throw new Error("Data da compra inválida");
  if (input.items.length < 1 || input.items.length > 100) throw new Error("A compra deve ter entre 1 e 100 itens");
  assertMoney(input.discountCents, "Desconto");
  assertMoney(input.surchargeCents, "Acréscimo");
  if ((input.notes?.trim().length ?? 0) > 4000) throw new Error("Observação da compra inválida");
  const keys = new Set<string>();
  for (const item of input.items) {
    if (!item.productId) throw new Error("Produto da compra inválido");
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 1_000_000) {
      throw new Error("Quantidade da compra inválida");
    }
    assertMoney(item.unitCostCents, "Custo unitário");
    const key = `${item.productId}:${item.variantId ?? "simple"}`;
    if (keys.has(key)) throw new Error("Produto/variante duplicado na compra");
    keys.add(key);
  }
}

async function loadItems(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  purchaseIds: string[],
): Promise<Map<string, PurchaseItem[]>> {
  const grouped = new Map<string, PurchaseItem[]>();
  if (purchaseIds.length === 0) return grouped;
  const rows = await sql.query(
    `select pi.*
     from public.merchant_purchase_items pi
     where pi.tenant_id=$1 and pi.store_id=$2
       and pi.purchase_id = any($3::uuid[])
     order by pi.created_at,pi.id`,
    [scope.tenantId, scope.storeId, purchaseIds],
  );
  for (const row of rows) {
    const purchaseId = text(row, "purchase_id");
    const list = grouped.get(purchaseId) ?? [];
    list.push(mapPurchaseItem(row));
    grouped.set(purchaseId, list);
  }
  return grouped;
}

async function getPurchase(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  purchaseId: string,
): Promise<Purchase> {
  const rows = await sql.query(
    `select p.*,s.name as supplier_name
     from public.merchant_purchases p
     left join public.merchant_suppliers s
       on s.tenant_id=p.tenant_id and s.store_id=p.store_id and s.id=p.supplier_id
     where p.tenant_id=$1 and p.store_id=$2 and p.id=$3::uuid`,
    [scope.tenantId, scope.storeId, purchaseId],
  );
  if (!rows[0]) throw new Error("Compra não encontrada");
  const items = await loadItems(sql, scope, [purchaseId]);
  return mapPurchase(rows[0], items.get(purchaseId) ?? []);
}

export async function listPurchases(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  query: PageQuery,
): Promise<Page<Purchase>> {
  assertScope(scope);
  assertPage(query.page, query.pageSize);
  const search = query.search?.trim() || null;
  const rows = await sql.query(
    `select p.*,s.name as supplier_name,count(*) over()::integer as total_count
     from public.merchant_purchases p
     left join public.merchant_suppliers s
       on s.tenant_id=p.tenant_id and s.store_id=p.store_id and s.id=p.supplier_id
     where p.tenant_id=$1 and p.store_id=$2
       and ($3::text is null
         or coalesce(s.name,'') ilike '%' || $3 || '%'
         or coalesce(p.notes,'') ilike '%' || $3 || '%'
         or p.id::text ilike '%' || $3 || '%')
     order by p.purchased_at desc,p.created_at desc,p.id desc
     limit $4 offset $5`,
    [scope.tenantId, scope.storeId, search, query.pageSize, (query.page - 1) * query.pageSize],
  );
  const ids = rows.map((row) => text(row, "id"));
  const items = await loadItems(sql, scope, ids);
  return {
    items: rows.map((row) => mapPurchase(row, items.get(text(row, "id")) ?? [])),
    page: query.page,
    pageSize: query.pageSize,
    total: rows.length ? integer(rows[0], "total_count") : 0,
  };
}

const CREATE_PURCHASE_SQL = `with raw_items as (
  select product_id,variant_id,quantity,unit_cost_cents
  from jsonb_to_recordset($8::jsonb) as x(
    product_id uuid,variant_id uuid,quantity integer,unit_cost_cents bigint
  )
), valid_items as (
  select r.product_id,r.variant_id,r.quantity,r.unit_cost_cents,
         p.name as product_name,
         case when r.variant_id is null then null else v.name end as variant_name,
         coalesce(v.sku,p.sku) as sku
  from raw_items r
  join public.products p
    on p.tenant_id=$1 and p.store_id=$2 and p.id=r.product_id
   and p.track_inventory=true
  left join public.product_variants v
    on r.variant_id is not null
   and v.tenant_id=$1 and v.store_id=$2
   and v.product_id=r.product_id and v.id=r.variant_id
  where r.quantity > 0 and r.unit_cost_cents >= 0
    and (r.variant_id is null or v.id is not null)
    and (
      r.variant_id is not null
      or not exists (
        select 1 from public.product_variants vx
        where vx.tenant_id=$1 and vx.store_id=$2 and vx.product_id=r.product_id
      )
    )
), stats as (
  select
    (select count(*) from raw_items)::integer as raw_count,
    count(*)::integer as valid_count,
    coalesce(sum(quantity::bigint * unit_cost_cents),0)::bigint as subtotal_cents
  from valid_items
), supplier_ok as (
  select ($3::uuid is null or exists (
    select 1 from public.merchant_suppliers s
    where s.tenant_id=$1 and s.store_id=$2 and s.id=$3::uuid and s.status='active'
  )) as ok
), inserted_purchase as (
  insert into public.merchant_purchases (
    tenant_id,store_id,supplier_id,purchased_at,status,
    subtotal_cents,discount_cents,surcharge_cents,total_cents,notes,created_by
  )
  select $1,$2,$3::uuid,$4::date,'draft',
         st.subtotal_cents,$5::bigint,$6::bigint,
         st.subtotal_cents-$5::bigint+$6::bigint,$7,$9::uuid
  from stats st cross join supplier_ok so
  where so.ok and st.raw_count > 0 and st.raw_count=st.valid_count
    and $5::bigint <= st.subtotal_cents+$6::bigint
  returning *
), inserted_items as (
  insert into public.merchant_purchase_items (
    tenant_id,store_id,purchase_id,product_id,variant_id,
    product_name,variant_name,sku,quantity,unit_cost_cents,subtotal_cents
  )
  select $1,$2,p.id,v.product_id,v.variant_id,
         v.product_name,v.variant_name,v.sku,v.quantity,v.unit_cost_cents,
         v.quantity::bigint*v.unit_cost_cents
  from valid_items v cross join inserted_purchase p
  returning id
)
select p.*,s.name as supplier_name,
  (select count(*) from inserted_items)::integer as inserted_item_count
from inserted_purchase p
left join public.merchant_suppliers s
  on s.tenant_id=p.tenant_id and s.store_id=p.store_id and s.id=p.supplier_id`;

function serializePurchaseItems(input: PurchaseInput): string {
  return JSON.stringify(input.items.map((item) => ({
    product_id: item.productId,
    variant_id: item.variantId,
    quantity: item.quantity,
    unit_cost_cents: item.unitCostCents,
  })));
}

export async function createPurchase(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  input: PurchaseInput,
  actorId: string,
): Promise<Purchase> {
  assertScope(scope);
  assertPurchase(input);
  const rows = await sql.query(CREATE_PURCHASE_SQL, [
    scope.tenantId,
    scope.storeId,
    input.supplierId,
    input.purchasedAt,
    input.discountCents,
    input.surchargeCents,
    nullable(input.notes),
    serializePurchaseItems(input),
    actorId,
  ]);
  if (!rows[0] || integer(rows[0], "inserted_item_count") !== input.items.length) {
    throw new Error("Compra inválida: verifique fornecedor, produtos, variantes e estoque controlado");
  }
  return getPurchase(sql, scope, text(rows[0], "id"));
}

export async function receivePurchase(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  purchaseId: string,
  actorId: string,
): Promise<Purchase> {
  assertScope(scope);
  await sql.query(
    `with locked as (
       update public.merchant_purchases
       set status='received',received_at=now(),received_by=$4::uuid,updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3::uuid and status='draft'
       returning id
     ), variant_delta as (
       select pi.product_id,pi.variant_id,sum(pi.quantity)::integer as qty
       from public.merchant_purchase_items pi join locked l on l.id=pi.purchase_id
       where pi.variant_id is not null
       group by pi.product_id,pi.variant_id
     ), update_variants as (
       update public.product_variants v
       set stock_quantity=v.stock_quantity+d.qty,updated_at=now()
       from variant_delta d
       where v.tenant_id=$1 and v.store_id=$2
         and v.product_id=d.product_id and v.id=d.variant_id
       returning v.id
     ), product_delta as (
       select pi.product_id,sum(pi.quantity)::integer as qty
       from public.merchant_purchase_items pi join locked l on l.id=pi.purchase_id
       where pi.variant_id is null
       group by pi.product_id
     ), update_products as (
       update public.products p
       set stock_quantity=p.stock_quantity+d.qty,updated_at=now()
       from product_delta d
       where p.tenant_id=$1 and p.store_id=$2 and p.id=d.product_id
       returning p.id
     )
     insert into public.stock_movements (
       tenant_id,store_id,product_id,variant_id,delta,reason,
       movement_type,reference_type,reference_id,created_by
     )
     select $1,$2,pi.product_id,pi.variant_id,pi.quantity,
            'Entrada por compra','purchase','merchant_purchase',pi.purchase_id,$4::uuid
     from public.merchant_purchase_items pi join locked l on l.id=pi.purchase_id
     on conflict do nothing`,
    [scope.tenantId, scope.storeId, purchaseId, actorId],
  );
  const current = await getPurchase(sql, scope, purchaseId);
  if (current.status === "cancelled") throw new Error("Compra cancelada não pode ser recebida");
  return current;
}

export async function cancelPurchase(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  purchaseId: string,
  actorId: string,
): Promise<Purchase> {
  assertScope(scope);
  const rows = await sql.query(
    `update public.merchant_purchases
     set status='cancelled',cancelled_at=now(),cancelled_by=$4::uuid,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3::uuid and status='draft'
     returning id`,
    [scope.tenantId, scope.storeId, purchaseId, actorId],
  );
  if (!rows[0]) {
    const current = await getPurchase(sql, scope, purchaseId);
    if (current.status === "received") {
      throw new Error("Compra já recebida: faça uma devolução de estoque em vez de cancelamento direto");
    }
    return current;
  }
  return getPurchase(sql, scope, purchaseId);
}

import type {
  InventoryHistoryPage,
  InventoryHistoryQuery,
  InventoryItem,
  InventoryMovement,
  InventoryPage,
  InventoryQuery,
  InventoryScope,
  StockMovementType,
  StockOperationInput,
  StockOperationResult,
} from "./types.ts";
import type {
  InventoryRepository,
  InventorySqlExecutor,
} from "./repository.ts";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function assertScope(scope: InventoryScope): void {
  if (!scope.tenantId || !scope.storeId) throw new Error("Escopo de estoque inválido");
}

function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

function safeInteger(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value)) throw new Error("Número inválido: " + key);
  return value;
}

function normalizePage(page: number | undefined): number {
  return Number.isInteger(page) && (page ?? 0) > 0 ? page as number : 1;
}

function normalizePageSize(pageSize: number | undefined): number {
  if (!Number.isInteger(pageSize) || (pageSize ?? 0) <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(pageSize as number, MAX_PAGE_SIZE);
}

function mapItem(row: Record<string, unknown>): InventoryItem {
  return {
    tenantId: requiredText(row, "tenant_id"),
    storeId: requiredText(row, "store_id"),
    productId: requiredText(row, "product_id"),
    variantId: nullableText(row, "variant_id"),
    productName: requiredText(row, "product_name"),
    variantName: nullableText(row, "variant_name"),
    sku: nullableText(row, "sku"),
    trackInventory: Boolean(row["track_inventory"]),
    currentQuantity: safeInteger(row, "current_quantity"),
  };
}

function mapMovement(row: Record<string, unknown>): InventoryMovement {
  return {
    tenantId: requiredText(row, "tenant_id"),
    storeId: requiredText(row, "store_id"),
    id: requiredText(row, "id"),
    productId: nullableText(row, "product_id"),
    variantId: nullableText(row, "variant_id"),
    productName: requiredText(row, "product_name"),
    variantName: nullableText(row, "variant_name"),
    sku: nullableText(row, "sku"),
    delta: safeInteger(row, "delta"),
    movementType: requiredText(row, "movement_type") as StockMovementType,
    reason: requiredText(row, "reason"),
    referenceType: nullableText(row, "reference_type"),
    referenceId: nullableText(row, "reference_id"),
    createdBy: nullableText(row, "created_by"),
    createdAt: requiredText(row, "created_at"),
  };
}

async function listPage(
  sql: InventorySqlExecutor,
  scope: InventoryScope,
  query: InventoryQuery,
): Promise<InventoryPage> {
  assertScope(scope);
  const page = normalizePage(query.page);
  const pageSize = normalizePageSize(query.pageSize);
  const search = query.search?.trim() || null;
  const rows = await sql.query(
    `with inventory_rows as (
       select p.tenant_id,p.store_id,p.id as product_id,v.id as variant_id,
         p.name as product_name,v.name as variant_name,coalesce(v.sku,p.sku) as sku,
         p.track_inventory,coalesce(sum(sm.delta),0)::integer as current_quantity
       from public.products p
       join public.product_variants v
         on v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
       left join public.stock_movements sm
         on sm.tenant_id=v.tenant_id and sm.store_id=v.store_id
        and sm.product_id=v.product_id and sm.variant_id=v.id
       where p.tenant_id=$1 and p.store_id=$2
       group by p.tenant_id,p.store_id,p.id,v.id,p.name,v.name,v.sku,p.sku,p.track_inventory
       union all
       select p.tenant_id,p.store_id,p.id,null::uuid,p.name,null::text,p.sku,
         p.track_inventory,coalesce(sum(sm.delta),0)::integer
       from public.products p
       left join public.stock_movements sm
         on sm.tenant_id=p.tenant_id and sm.store_id=p.store_id
        and sm.product_id=p.id and sm.variant_id is null
       where p.tenant_id=$1 and p.store_id=$2
         and not exists (
           select 1 from public.product_variants v
           where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
         )
       group by p.tenant_id,p.store_id,p.id,p.name,p.sku,p.track_inventory
     )
     select *,count(*) over()::integer as total_count
     from inventory_rows
     where $3::text is null
       or product_name ilike '%' || $3 || '%'
       or coalesce(variant_name,'') ilike '%' || $3 || '%'
       or coalesce(sku,'') ilike '%' || $3 || '%'
     order by product_name,variant_name nulls first
     limit $4 offset $5`,
    [scope.tenantId, scope.storeId, search, pageSize, (page - 1) * pageSize],
  );
  return {
    items: rows.map(mapItem),
    page,
    pageSize,
    total: rows.length ? safeInteger(rows[0], "total_count") : 0,
  };
}

async function history(
  sql: InventorySqlExecutor,
  scope: InventoryScope,
  query: InventoryHistoryQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE },
): Promise<InventoryHistoryPage> {
  assertScope(scope);
  const page = normalizePage(query.page);
  const pageSize = normalizePageSize(query.pageSize);
  const search = query.search?.trim() || null;
  const movementType = query.movementType ?? null;
  const rows = await sql.query(
    `select sm.id::text,sm.tenant_id::text,sm.store_id::text,
       sm.product_id::text,sm.variant_id::text,
       coalesce(p.name,'Produto removido') as product_name,
       v.name as variant_name,coalesce(v.sku,p.sku) as sku,
       sm.delta,sm.movement_type,sm.reason,sm.reference_type,
       sm.reference_id::text,sm.created_by::text,sm.created_at::text,
       count(*) over()::integer as total_count
     from public.stock_movements sm
     left join public.products p
       on p.tenant_id=sm.tenant_id and p.store_id=sm.store_id and p.id=sm.product_id
     left join public.product_variants v
       on v.tenant_id=sm.tenant_id and v.store_id=sm.store_id
      and v.product_id=sm.product_id and v.id=sm.variant_id
     where sm.tenant_id=$1 and sm.store_id=$2
       and ($3::text is null
         or coalesce(p.name,'Produto removido') ilike '%' || $3 || '%'
         or coalesce(v.name,'') ilike '%' || $3 || '%'
         or coalesce(v.sku,p.sku,'') ilike '%' || $3 || '%'
         or sm.reason ilike '%' || $3 || '%')
       and ($4::text is null or sm.movement_type=$4)
     order by sm.created_at desc,sm.id desc
     limit $5 offset $6`,
    [scope.tenantId, scope.storeId, search, movementType, pageSize, (page - 1) * pageSize],
  );
  return {
    items: rows.map(mapMovement),
    page,
    pageSize,
    total: rows.length ? safeInteger(rows[0], "total_count") : 0,
  };
}

function assertOperation(input: StockOperationInput): void {
  if (!input.operationId) throw new Error("Identificador da operação ausente");
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > 1_000_000) {
    throw new Error("Quantidade inválida");
  }
  if (input.kind !== "set" && input.quantity === 0) throw new Error("Quantidade inválida");
  if (!input.reason.trim() || input.reason.trim().length > 240) throw new Error("Motivo inválido");
}

function operationType(kind: StockOperationInput["kind"]): StockMovementType {
  if (kind === "entry") return "purchase";
  if (kind === "set") return "adjustment";
  return "manual";
}

function movementFragments(variant: boolean) {
  return {
    table: variant ? "public.product_variants" : "public.products", alias: variant ? "v" : "p",
    variantPredicate: variant ? "and v.product_id=$3 and v.id=$4" : `and p.id=$3::uuid and $4::uuid is null and not exists (
      select 1 from public.product_variants vx where vx.tenant_id=p.tenant_id and vx.store_id=p.store_id and vx.product_id=p.id
    )`,
    productJoin: variant ? `join public.products p on p.tenant_id=v.tenant_id and p.store_id=v.store_id and p.id=v.product_id and p.track_inventory=true` : "",
    productId: variant ? "v.product_id" : "p.id", variantId: variant ? "v.id" : "null::uuid",
  };
}

function movementSql(variant: boolean): string {
  const { table, alias, variantPredicate, productJoin, productId, variantId } = movementFragments(variant);
  return `with target as (
      select ${alias}.stock_quantity::integer as current_quantity,
        ${productId} as product_id,${variantId} as variant_id
      from ${table} ${alias}
      ${productJoin}
      where ${alias}.tenant_id=$1 and ${alias}.store_id=$2
        ${variantPredicate}
        ${variant ? "" : "and p.track_inventory=true"}
      for update of ${alias}
    ), calc as (
      select current_quantity,product_id,variant_id,
        case $5::text
          when 'entry' then $6::integer
          when 'exit' then -$6::integer
          when 'set' then $6::integer-current_quantity
        end as delta,
        case $5::text
          when 'entry' then current_quantity+$6::integer
          when 'exit' then current_quantity-$6::integer
          when 'set' then $6::integer
        end as new_quantity
      from target
    ), movement as (
      insert into public.stock_movements (
        tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,
        reference_type,reference_id,created_by
      )
      select $1,$2,product_id,variant_id,delta,$7,$8,
        'inventory_operation',$9::uuid,$10::uuid
      from calc
      where delta<>0 and new_quantity>=0
      on conflict do nothing
      returning delta
    ), updated as (
      update ${table} ${alias}
      set stock_quantity=c.new_quantity,updated_at=now()
      from calc c,movement m
      where ${alias}.tenant_id=$1 and ${alias}.store_id=$2
        and ${variant ? "v.product_id=c.product_id and v.id=c.variant_id" : "p.id=c.product_id"}
      returning ${alias}.stock_quantity::integer as current_quantity
    )
    select
      exists(select 1 from target) as found,
      coalesce((select new_quantity>=0 from calc),false) as allowed,
      coalesce((select current_quantity from updated),(select current_quantity from target),0)::integer as current_quantity,
      coalesce((select delta from movement),0)::integer as delta,
      exists(select 1 from movement) as applied`;
}

async function move(
  sql: InventorySqlExecutor,
  scope: InventoryScope,
  input: StockOperationInput,
): Promise<StockOperationResult> {
  assertScope(scope);
  assertOperation(input);
  const type = operationType(input.kind);
  const rows = await sql.query(
    movementSql(input.variantId !== null),
    [
      scope.tenantId,
      scope.storeId,
      input.productId,
      input.variantId,
      input.kind,
      input.quantity,
      input.reason.trim(),
      type,
      input.operationId,
      input.createdBy,
    ],
  );
  if (rows.length === 0) throw new Error("Falha ao movimentar estoque");
  const row = rows[0];
  if (row["found"] !== true) throw new Error("Produto ou variante não encontrado");
  if (row["allowed"] !== true) throw new Error("Estoque insuficiente");
  return {
    currentQuantity: safeInteger(row, "current_quantity"),
    delta: safeInteger(row, "delta"),
    applied: row["applied"] === true,
  };
}

export function createInventoryRepository(
  sql: InventorySqlExecutor,
): InventoryRepository {
  return {
    list: async (scope) => {
      const page = await listPage(sql, scope, { page: 1, pageSize: MAX_PAGE_SIZE });
      return page.items;
    },
    listPage: (scope, query) => listPage(sql, scope, query),
    history: (scope, query) => history(sql, scope, query),
    move: (scope, input) => move(sql, scope, input),
  };
}

import type { CatalogScope,CatalogSqlExecutor } from "@white-label/catalog";
import type { ProductListAction } from "./product-list.schema.ts";
export async function applyProductListAction(sql:CatalogSqlExecutor,scope:CatalogScope,data:ProductListAction,userId:string|null){
    const ids = [...new Set(data.ids)], scopeParams = [scope.tenantId,scope.storeId];
    const products = await sql.query("select id from public.products where tenant_id=$1 and store_id=$2 and id=any($3::uuid[]) and deleted_at is null for update",[...scopeParams,ids]);
    if (products.length !== ids.length) throw new Error("Um dos produtos não pertence a esta loja ou já foi excluído.");
    if (data.action === "category") {
      if (data.categoryId) {
        const category = await sql.query("select id from public.categories where tenant_id=$1 and store_id=$2 and id=$3",[...scopeParams,data.categoryId]);
        if (!category.length) throw new Error("Categoria não pertence a esta loja");
      }
      await sql.query("update public.products set category_id=$4::uuid,updated_at=now() where tenant_id=$1 and store_id=$2 and id=any($3::uuid[])",[...scopeParams,ids,data.categoryId ?? null]);
      await sql.query("delete from public.product_categories where tenant_id=$1 and store_id=$2 and product_id=any($3::uuid[])",[...scopeParams,ids]);
      if (data.categoryId) await sql.query("insert into public.product_categories(tenant_id,store_id,product_id,category_id) select $1,$2,unnest($3::uuid[]),$4::uuid",[...scopeParams,ids,data.categoryId]);
    } else {
      await sql.query("update public.products set active=$4,deleted_at=case when $5 then now() else deleted_at end,updated_at=now() where tenant_id=$1 and store_id=$2 and id=any($3::uuid[])",[...scopeParams,ids,data.action === "publish",data.action === "delete"]);
    }
    await sql.query(`insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
      select $4::uuid,$1,$2,$5,'product',unnest($3::uuid[])::text,$6::jsonb returning id`,[...scopeParams,ids,userId,`product.${data.action}`,JSON.stringify({category_id:data.categoryId ?? null})]);
    return {changed:ids.length};
}

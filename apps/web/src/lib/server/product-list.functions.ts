import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { withAdminTransaction } from "./supabase-admin.server.ts";
import { assertProductMutationEntitlements } from "./catalog-entitlements.server.ts";
import { productListActionSchema } from "./product-list.schema.ts";
import { applyProductListAction } from "./product-list.server.ts";
export const changeMerchantProducts = createServerFn({method:"POST"}).validator(productListActionSchema).handler(async ({data}) => {
  const current = await createMerchantCatalogContext(getRequestHost());
  return withAdminTransaction(async sql => {
    await assertProductMutationEntitlements(sql,current.scope,"update");
    return applyProductListAction(sql,current.scope,data,current.userId);
  });
});

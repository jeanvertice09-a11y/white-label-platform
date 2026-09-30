import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { withAdminTransaction } from "./supabase-admin.server.ts";
import { assertProductMutationEntitlements, assertVariantMutationEntitlements } from "./catalog-entitlements.server.ts";
import { productEditorSchema } from "./product-editor.schema.ts";
import { saveProductEditor } from "./product-editor.server.ts";
export const saveMerchantProductEditor = createServerFn({ method: "POST" }).validator(productEditorSchema).handler(async ({ data }) => {
  const current = await createMerchantCatalogContext(getRequestHost());
  return withAdminTransaction(async (sql) => {
    await assertProductMutationEntitlements(sql, current.scope, data.id ? "update" : "create");
    if (data.variants.length) await assertVariantMutationEntitlements(sql, current.scope);
    const saved = await saveProductEditor(sql, current.scope, data, current.userId);
    if (!saved) throw new Error("Não foi possível carregar o produto salvo");
    return saved;
  });
});

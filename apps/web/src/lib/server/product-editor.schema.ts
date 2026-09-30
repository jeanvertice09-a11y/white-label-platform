import { z } from "zod";
const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().min(0).max(1_000_000);
export const editorVariantSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(180).nullable(), attributes: z.record(z.string().min(1).max(80), z.string().min(1).max(120)),
  priceCents: money, compareAtPriceCents: money.nullable(), costCents: money.nullable(), active: z.boolean(),
  stockQuantity: quantity, expectedStockQuantity: quantity.optional(), position: quantity,
});
export const productEditorSchema = z.object({
  id: z.string().uuid().optional(),
  input: z.object({
    name: z.string().trim().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
    description: z.string().trim().max(5000).nullable(), sku: z.string().trim().max(180).nullable(),
    barcode: z.string().trim().max(180).nullable(), featured: z.boolean(),
    categoryId: z.string().uuid().nullable(), categoryIds: z.array(z.string().uuid()).max(100),
    priceCents: money, compareAtPriceCents: money.nullable(), costCents: money.nullable(),
    discountType: z.enum(["percentage", "fixed"]).nullable(), discountValue: quantity.nullable(),
    pixDiscountPercent: z.number().min(0).max(100).nullable(), freeShipping: z.boolean(),
    active: z.boolean(), trackInventory: z.boolean(), stockQuantity: quantity, position: quantity,
  }),
  expectedStockQuantity: quantity.optional(),
  photos: z.array(z.object({ assetId: z.string().uuid(), position: quantity })).max(50).default([]),
  variants: z.array(editorVariantSchema).max(200),
});
export type ProductEditorInput = z.infer<typeof productEditorSchema>;

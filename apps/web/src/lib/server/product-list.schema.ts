import { z } from "zod";
export const productListActionSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), action: z.enum(["publish","hide","delete","category"]), categoryId: z.string().uuid().nullable().optional() });
export type ProductListAction = z.infer<typeof productListActionSchema>;

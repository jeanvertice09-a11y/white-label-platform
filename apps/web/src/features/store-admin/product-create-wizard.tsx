import type { Category } from "@white-label/catalog";
import { ProductForm } from "./product-form.tsx";
export function ProductCreateWizard({categories}: Readonly<{categories: Category[]}>) {
  return <ProductForm product={null} categories={categories} />;
}

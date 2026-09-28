import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { ProductImageManager } from "../features/store-admin/product-image-manager.tsx";
import { VariantEditor } from "../features/store-admin/variant-editor.tsx";
import { getMerchantProduct, listMerchantCategories } from "../lib/server/catalog.functions.ts";
export const Route=createFileRoute("/admin/products/$id")({loader:async({params})=>{const[product,categories]=await Promise.all([getMerchantProduct({data:{id:params.id}}),listMerchantCategories()]);if(!product)throw new Error("Produto não encontrado nesta loja");return{product,categories};},pendingComponent:AdminRoutePending,errorComponent:AdminRouteError,component:EditProductPage});
function EditProductPage():React.JSX.Element{const data=Route.useLoaderData();return <div className="k-page"><PageHead title={data.product.name} description="Tudo do produto em um só lugar: informações, fotos, variações e estoque." action={<Link className="k-button" to="/admin/products">Voltar aos produtos</Link>}/><ProductForm product={data.product} categories={data.categories}/><ProductImageManager product={data.product}/><VariantEditor productId={data.product.id} variants={data.product.variants}/></div>;}

import { createRoot } from "react-dom/client";
import { createRootRoute,createRoute,createRouter,RouterProvider,Outlet } from "../../apps/web/node_modules/@tanstack/react-router/dist/esm/index.js";
import { ProductForm } from "../../apps/web/src/features/store-admin/product-form.tsx";
import { sample } from "./mocks.ts";
import "../../apps/web/src/admin/tokens.css";
import "../../apps/web/src/admin/base.css";
import "../../apps/web/src/admin/product-studio.css";
import "../../apps/web/src/admin/product-editor.css";
function Frame(){return <main className="admin" style={{maxWidth:1100,margin:"auto",padding:24}}><h1>Produtos</h1><Outlet/></main>;}
function New(){return <ProductForm product={null} categories={[]}/>;}
function Edit(){return <ProductForm product={window.editorProduct??sample} categories={[]}/>;}
const root=createRootRoute({component:Frame});
const index=createRoute({getParentRoute:()=>root,path:"/",component:New});
const edit=createRoute({getParentRoute:()=>root,path:"/admin/products/$id",component:Edit});
const router=createRouter({routeTree:root.addChildren([index,edit])});
const container=document.getElementById("root");
if(container)createRoot(container).render(<RouterProvider router={router}/>);

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const mock=fileURLToPath(new URL("./mocks.ts",import.meta.url));
export default defineConfig({root:fileURLToPath(new URL(".",import.meta.url)),plugins:[{
  name:"editor-test-boundaries",enforce:"pre",resolveId(source){
    return /(?:product-editor\.functions|catalog-admin\.functions|media-association\.functions|media-upload)\.ts$/.test(source)?mock:null;
  }
}],esbuild:{jsx:"automatic"},optimizeDeps:{exclude:["@tanstack/react-router","@tanstack/router-core","@tanstack/history"]},server:{host:"127.0.0.1",port:5188,fs:{allow:[fileURLToPath(new URL("../../",import.meta.url))]}},resolve:{alias:{react:fileURLToPath(new URL("../../apps/web/node_modules/react",import.meta.url)),"react-dom":fileURLToPath(new URL("../../apps/web/node_modules/react-dom",import.meta.url)),"@white-label/catalog":fileURLToPath(new URL("../../packages/catalog/src/index.ts",import.meta.url))}}});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [tanstackStart(), nitro(), react()],
  resolve: {
    alias: {
      "@white-label/payments/server": fileURLToPath(
        new URL("../../packages/payments/src/server.ts", import.meta.url),
      ),
    },
  },
  server: { port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  ssr: {
    noExternal: [
      "react",
      "react-dom",
      "postgres",
      "@tanstack/react-router",
      "@tanstack/react-start",
      "@white-label/auth",
      "@white-label/billing",
      "@white-label/catalog",
      "@white-label/domains",
      "@white-label/tenant",
      "@white-label/validation",
      "@white-label/orders",
      "@white-label/inventory",
      "@white-label/customers",
      "@white-label/marketing",
    ],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [tanstackStart(), react()],
  server: { port: 5173 },
  build: { 
    outDir: "dist", 
    sourcemap: false,
    rollupOptions: {
      external: ["@white-label/domains", "@white-label/auth", "@white-label/tenant", "@white-label/validation"],
    },
  },
  ssr: {
    external: ["@white-label/domains", "@white-label/auth", "@white-label/tenant", "@white-label/validation"],
    noExternal: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
});
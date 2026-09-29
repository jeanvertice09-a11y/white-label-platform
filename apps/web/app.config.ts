// TanStack Start: SSR + file-routes. Nesta fundação o build executa via
// Vite client; as server functions vivem em src/lib/server/* (server-only)
// e validam TenantContext + RBAC antes de qualquer repository.
const config = {
  routers: {
    ssr: true,
  },
};

export default config;

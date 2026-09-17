import { test, expect } from "@playwright/test";

// Visitante não autenticado: rotas protegidas negam (fail closed).
// O conteúdo placeholder NUNCA é exibido sem contexto válido.
test("visitante NÃO acessa /master", async ({ page }) => {
  await page.goto("/master");
  await expect(page.getByRole("heading", { name: /negado|necessária/i })).toBeVisible();
  await expect(page.getByText(/Tenants \(placeholder\)/)).toHaveCount(0);
});

test("visitante NÃO acessa /control", async ({ page }) => {
  await page.goto("/control");
  await expect(page.getByRole("heading", { name: /negado|necessária|não resolv/i })).toBeVisible();
});

test("visitante NÃO acessa /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /negado|necessária|não resolv/i })).toBeVisible();
});

test("home pública renderiza fundação", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /White Label Platform/i })).toBeVisible();
});

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function expectGuestRedirect(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("body")).not.toContainText("Tenants (placeholder)");
}

test("visitante é redirecionado para login ao acessar /master", async ({ page }) => {
  await expectGuestRedirect(page, "/master");
});

test("visitante é redirecionado para login ao acessar /control", async ({ page }) => {
  await expectGuestRedirect(page, "/control");
});

test("visitante é redirecionado para login ao acessar /admin", async ({ page }) => {
  await expectGuestRedirect(page, "/admin");
});

test("home pública local renderiza a experiência Kataluu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Venda uma plataforma completa sem começar do zero/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acessar painel/i }).first()).toBeVisible();
});

test("/login renderiza experiência pública de acesso", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Entrar na plataforma|Escolha o ambiente correto/i })).toBeVisible();
});

const storefrontHost = process.env["E2E_STOREFRONT_HOST"];
const productSlug = process.env["E2E_PRODUCT_SLUG"];

test("domínio real → produto → carrinho → superfície de checkout", async ({ page }) => {
  if (!storefrontHost || !productSlug) {
    test.skip(true, "Requer E2E_STOREFRONT_HOST e E2E_PRODUCT_SLUG de uma loja fixture ativa.");
    return;
  }
  const origin = storefrontHost.startsWith("http") ? storefrontHost : `https://${storefrontHost}`;
  await page.goto(`${origin}/produto/${productSlug}`);
  await expect(page.locator("h1.sf__product-title")).toBeVisible();

  const variants = page.locator(".sf__variant:not([disabled])");
  if (await variants.count()) await variants.first().click();
  const add = page.getByRole("button", { name: "Adicionar ao carrinho" });
  await expect(add).toBeEnabled();
  await add.click();

  const checkout = page.getByRole("dialog", { name: "Carrinho e checkout" });
  await expect(checkout).toBeVisible();
  await expect(checkout.getByText(/validado.*servidor/i)).toBeVisible();
  await expect(checkout.getByRole("button", { name: /Confirmar pedido|Pedido mínimo não atingido/ })).toBeVisible();
});

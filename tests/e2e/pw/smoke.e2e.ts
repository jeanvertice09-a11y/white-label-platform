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

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

const adminRoutes = [
  "admin.tsx", "admin.index.tsx", "admin.products.tsx", "admin.products.new.tsx", "admin.products.$id.tsx",
  "admin.categories.tsx", "admin.inventory.tsx", "admin.orders.tsx", "admin.orders.index.tsx", "admin.orders.$id.tsx",
  "admin.customers.tsx", "admin.customers.index.tsx", "admin.customers.$id.tsx", "admin.finance.tsx", "admin.purchases.tsx",
  "admin.suppliers.tsx", "admin.tasks.tsx", "admin.campaigns.tsx", "admin.coupons.tsx", "admin.marketing.tsx",
  "admin.operations.tsx", "admin.settings.tsx", "admin.store.tsx", "admin.store.index.tsx", "admin.store.appearance.tsx",
  "admin.store.banners.tsx", "admin.store.catalog.tsx",
] as const;

describe("responsive merchant/storefront final QA", () => {
  test("all merchant admin routes remain covered by the shared responsive shell", () => {
    for (const route of adminRoutes) expect(existsSync(join(ROOT, "apps/web/src/routes", route))).toBe(true);
    const route = source("apps/web/src/routes/admin.tsx");
    expect(route).toContain('import "../styles/responsive-merchant.css"');
    expect(route).toContain('import "../styles/responsive-merchant-qa.css"');
    expect(route.indexOf('import "../styles/responsive-merchant.css"')).toBeGreaterThan(route.indexOf('import "../styles/merchant-uiux.css"'));
  });

  test("admin drawer is keyboard-contained and restores focus", () => {
    const shell = source("apps/web/src/features/store-admin/admin-shell.tsx");
    const qaCss = source("apps/web/src/styles/responsive-merchant-qa.css");
    expect(shell).toContain("k-admin__mobile-nav");
    expect(shell).toContain('aria-controls="merchant-navigation"');
    expect(shell).toContain("aria-expanded={mobileOpen}");
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain('event.key !== "Tab"');
    expect(shell).toContain("openerRef.current?.focus()");
    expect(shell).toContain('document.body.style.overflow = "hidden"');
    expect(qaCss).toContain("visibility: hidden");
    expect(qaCss).toContain("pointer-events: none");
    expect(qaCss).toContain(".k-admin__sidebar.is-open");
  });

  test("admin layout blocks global horizontal overflow and rigid mobile editors", () => {
    const css = source("apps/web/src/styles/responsive-merchant.css");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain(".k-inline-editor[open]");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("overscroll-behavior-inline: contain");
    expect(css).toContain("bottom: calc(62px + env(safe-area-inset-bottom))");
    for (const token of ["#7b5ea7", "#a78bcc", "#2d2b4e", "#efe9fa"]) expect(css).toContain(token);
    expect(css).toContain('"Plus Jakarta Sans"');
  });

  test("variant editor associates visible labels with controls", () => {
    const variant = source("apps/web/src/features/store-admin/variant-editor.tsx");
    expect(variant).toContain('<label className="k-field">');
    expect(variant).toContain('<label className="k-field k-field--full">');
    for (const label of ["Nome da variante", "SKU", "Preço", "Preço comparativo", "Custo interno", "Estoque atual", "Ordem", "Atributos"]) expect(variant).toContain(`<span>${label}</span>`);
  });

  test("storefront responsive layer covers narrow phones through large desktops", () => {
    const css = source("apps/web/src/features/storefront/storefront-responsive-theme.ts");
    for (const breakpoint of ["max-width:350px", "max-width:375px", "max-width:430px", "max-width:768px", "max-width:1024px", "min-width:1280px", "min-width:1600px"]) expect(css).toContain(breakpoint);
    expect(css).toContain("overflow-x:clip");
    expect(css).toContain("overflow-wrap:anywhere");
    expect(css).toContain("position:sticky; bottom:");
    expect(css).toContain(".sf__field textarea");
    expect(css).not.toContain("gap-left");
    expect(css).not.toContain("gap-right");
  });

  test("Classic, Modern and product detail receive the responsive layer after advanced styles", () => {
    const view = source("apps/web/src/features/storefront/storefront-view.tsx");
    const product = source("apps/web/src/routes/produto.$slug.tsx");
    expect(view).toContain("storefrontTheme + storefrontAdvancedTheme + storefrontResponsiveTheme");
    expect(view).toContain("sf--${data.settings.layout}");
    expect(product).toContain("storefrontTheme + storefrontAdvancedTheme + storefrontResponsiveTheme");
  });

  test("cart traps and restores focus while preserving server-authoritative checkout", () => {
    const cart = source("apps/web/src/features/storefront/cart-panel.tsx");
    expect(cart).toContain('document.body.style.overflow = "hidden"');
    expect(cart).toContain('event.key === "Escape"');
    expect(cart).toContain('event.key !== "Tab"');
    expect(cart).toContain("previousFocus.focus()");
    expect(cart).toContain("ref={dialogRef}");
    expect(cart).toContain("refreshPublicCart");
    expect(cart).toContain("createWhatsappOrder");
    expect(cart).toContain("MAX_CART_QUANTITY = 999");
  });

  test("promotion copy cannot be silently clipped by an unbroken long string", () => {
    const promo = source("apps/web/src/features/storefront/promotional-bar.tsx");
    expect(promo).toContain(".sf-promo>*{min-width:0;max-width:100%;overflow-wrap:anywhere}");
  });

  test("commercial landing uses the current identity and a dedicated mobile mockup", () => {
    const landing = source("apps/web/src/features/public/kataluu-landing.tsx");
    const publicCss = source("apps/web/src/styles/responsive-public.css");
    const root = source("apps/web/src/routes/index.tsx");
    expect(landing).toContain('primaryColor: "#7B5EA7"');
    expect(landing).toContain("public-mobile-stage");
    expect(landing).toContain("Painel da loja / Produtos");
    expect(publicCss).toContain("#c8f7a6");
    expect(publicCss).toContain(".public-product-stage { display:none; }");
    expect(publicCss).toContain(".public-mobile-stage { display:block;");
    expect(publicCss).toContain("overflow-x: clip");
    expect(publicCss).toContain("prefers-reduced-motion:reduce");
    expect(root).toContain('import "../styles/responsive-public.css"');
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const consoleCss = readFileSync("apps/web/src/styles/platform-responsive.css", "utf8");
const authCss = readFileSync("apps/web/src/styles/auth-responsive.css", "utf8");
const masterShell = readFileSync("apps/web/src/components/master/MasterShell.tsx", "utf8");
const controlShell = readFileSync("apps/web/src/features/control/control-shell.tsx", "utf8");
const masterRoute = readFileSync("apps/web/src/routes/master.tsx", "utf8");
const controlRoute = readFileSync("apps/web/src/routes/control.tsx", "utf8");
const loginRoute = readFileSync("apps/web/src/routes/login.tsx", "utf8");
const mfaRoute = readFileSync("apps/web/src/routes/mfa.tsx", "utf8");

describe("responsive platform console contracts", () => {
  test("mantém a identidade visual atual no layer final", () => {
    expect(consoleCss).toContain("--console-primary: #7B5EA7");
    expect(authCss).toContain("#A78BCC");
    expect(consoleCss).toContain("#2D2B4E");
    expect(consoleCss).toContain("#EFE9FA");
    expect(consoleCss).toContain("#C8F7A6");
    expect(consoleCss).toContain('font-family: "Plus Jakarta Sans"');
  });

  test("tabelas densas possuem viewport própria e tokens longos não expandem a página", () => {
    expect(consoleCss).toContain("overflow-x: auto");
    expect(consoleCss).toContain("overscroll-behavior-inline: contain");
    expect(consoleCss).toContain("overflow-wrap: anywhere");
    expect(consoleCss).not.toContain("100vw");
  });

  test("cobre mobile pequeno, tablet, desktop intermediário e telas largas", () => {
    for (const contract of [
      "@media (max-width: 360px)",
      "@media (max-width: 430px)",
      "@media (max-width: 768px)",
      "@media (max-width: 979px)",
      "@media (min-width: 980px) and (max-width: 1279px)",
      "@media (min-width: 1920px)",
    ]) expect(consoleCss).toContain(contract);
    expect(authCss).toContain("@media (max-width: 320px)");
    expect(authCss).toContain("@media (max-width: 390px)");
    expect(consoleCss).toContain("env(safe-area-inset-bottom)");
    expect(consoleCss).toContain("min-height: 44px");
  });

  test("drawer Master e Control expõe estado, relação e fechamento por Escape", () => {
    for (const source of [masterShell, controlShell]) {
      expect(source).toContain("aria-expanded={mobileOpen}");
      expect(source).toContain("aria-controls=");
      expect(source).toContain('event.key !== "Escape"');
      expect(source).toContain('document.body.style.overflow = "hidden"');
    }
  });

  test("layers responsivos são carregados por último nas superfícies corretas", () => {
    expect(masterRoute).toContain('import "../styles/platform-responsive.css"');
    expect(controlRoute).toContain('import "../styles/platform-responsive.css"');
    expect(loginRoute).toContain('import "../styles/auth-responsive.css"');
    expect(mfaRoute).toContain('import "../styles/auth-responsive.css"');
  });

  test("auth e onboarding cabem em 320px sem largura rígida e preservam reduced motion", () => {
    expect(authCss).toContain("@media (max-width: 320px)");
    expect(authCss).toContain("max-width: min(220px, 100%)");
    expect(authCss).toContain("overflow-x: clip");
    expect(authCss).toContain("prefers-reduced-motion: reduce");
    expect(authCss).not.toContain("100vw");
  });
});

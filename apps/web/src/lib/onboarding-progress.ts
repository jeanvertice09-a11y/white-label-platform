export interface OnboardingFacts {
  hasBasicStore: boolean;
  hasContact: boolean;
  hasAppearance: boolean;
  hasCatalogSettings: boolean;
  categoryCount: number;
  productCount: number;
  hasPublicDomain: boolean;
  storeActive: boolean;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  optional: boolean;
  complete: boolean;
}

export function deriveOnboardingSteps(facts: OnboardingFacts): OnboardingStep[] {
  const coreReady = facts.hasBasicStore && facts.hasAppearance && facts.hasCatalogSettings && facts.productCount > 0 && facts.hasPublicDomain;
  const steps: OnboardingStep[] = [
    { id: "store", title: "Dados básicos da loja", description: "Nome e identidade básica da operação.", href: "/admin/settings", optional: false, complete: facts.hasBasicStore },
    { id: "contact", title: "Contato", description: "Telefone, e-mail público, endereço ou Instagram.", href: "/admin/settings", optional: true, complete: facts.hasContact },
    { id: "appearance", title: "Identidade e aparência", description: "Layout, cores e tipografia do catálogo.", href: "/admin/store/appearance", optional: false, complete: facts.hasAppearance },
    { id: "catalog", title: "Configuração do catálogo", description: "Checkout, WhatsApp, busca, categorias e SEO.", href: "/admin/store/catalog", optional: false, complete: facts.hasCatalogSettings },
    { id: "categories", title: "Categorias", description: "Organize o catálogo quando sua operação precisar.", href: "/admin/categories", optional: true, complete: facts.categoryCount > 0 },
    { id: "products", title: "Primeiro produto ou importação", description: "Cadastre manualmente ou use a importação CSV.", href: "/admin/products#importar-produtos", optional: false, complete: facts.productCount > 0 },
    { id: "domain", title: "Endereço público", description: "Confirme que a loja possui um domínio/endereço público ativo.", href: "/admin/settings", optional: false, complete: facts.hasPublicDomain },
    { id: "review", title: "Revisão", description: "Revise os itens essenciais antes de divulgar a loja.", href: "/admin/store", optional: false, complete: coreReady },
    { id: "ready", title: "Loja pronta", description: "Loja ativa, com catálogo e endereço público disponíveis.", href: "/admin/store", optional: false, complete: coreReady && facts.storeActive },
  ];
  return steps;
}

export function onboardingProgress(steps: readonly OnboardingStep[]): { completed: number; total: number; percent: number } {
  const required = steps.filter((step) => !step.optional);
  const completed = required.filter((step) => step.complete).length;
  const total = required.length;
  return { completed, total, percent: total === 0 ? 100 : Math.round((completed / total) * 100) };
}

// Três níveis financeiros — fluxos isolados, sem compartilhar ledger/conta.
export type BillingLevel = "platform_billing" | "tenant_billing" | "store_checkout";

export interface BillingLevelPolicy {
  level: BillingLevel;
  /** Onde vive a gateway account deste nível. */
  gatewayAccountScope: "platform" | "tenant" | "store";
  description: string;
}

export const BILLING_LEVELS: readonly BillingLevelPolicy[] = [
  {
    level: "platform_billing",
    gatewayAccountScope: "platform",
    description: "Plataforma cobra o White Label (assinatura SaaS do tenant).",
  },
  {
    level: "tenant_billing",
    gatewayAccountScope: "tenant",
    description: "White Label cobra seus lojistas/assinantes.",
  },
  {
    level: "store_checkout",
    gatewayAccountScope: "store",
    description: "Consumidor final paga ao lojista (checkout online, se habilitado).",
  },
];

/** Garante que webhook/ledger de um nível nunca seja aplicado em outro. */
export function assertBillingLevelIsolation(
  eventLevel: BillingLevel,
  targetLevel: BillingLevel,
): void {
  if (eventLevel !== targetLevel) {
    throw new Error(`Nível financeiro divergente: ${eventLevel} !== ${targetLevel}`);
  }
}

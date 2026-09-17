/** Guardas de store: membership explícita, nunca UUID do navegador. */
export interface StoreMembership {
  storeId: string;
  roles: string[];
}

export function canOperateStore(memberships: StoreMembership[], storeId: string): boolean {
  return memberships.some((m) => m.storeId === storeId && m.roles.length > 0);
}

export function assertCanOperateStore(memberships: StoreMembership[], storeId: string): void {
  if (!canOperateStore(memberships, storeId)) {
    throw new Error("Sem membership nesta store");
  }
}

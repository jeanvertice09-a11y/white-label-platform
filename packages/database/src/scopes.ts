// Helpers de escopo: toda query sensível carrega tenant_id (+store_id).
// Nunca montar SQL concatenando input — usar parâmetros ($1, $2...).

export interface TenantScope {
  tenantId: string;
  storeId?: string;
}

export function scopedWhere(scope: TenantScope, startIndex = 1): { clause: string; params: string[] } {
  if (scope.storeId) {
    return {
      clause: `tenant_id = $${String(startIndex)} AND store_id = $${String(startIndex + 1)}`,
      params: [scope.tenantId, scope.storeId],
    };
  }
  return { clause: `tenant_id = $${String(startIndex)}`, params: [scope.tenantId] };
}

export function assertScope(scope: TenantScope): void {
  if (!scope.tenantId) throw new Error("tenantId é obrigatório no escopo");
}

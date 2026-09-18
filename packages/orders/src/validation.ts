import type { CreateOrderFromCartInput, OrderScope } from "./types.ts";

export function assertOrderScope(scope: OrderScope): void {
  if (!scope.tenantId || !scope.storeId) throw new Error("Escopo de pedido inválido");
}

export function assertCreateOrderInput(input: CreateOrderFromCartInput): void {
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 120) {
    throw new Error("Chave de idempotência inválida");
  }
  if (input.items.length < 1 || input.items.length > 100) throw new Error("Carrinho inválido");
  if (!Number.isInteger(input.shippingCents) || input.shippingCents < 0) {
    throw new Error("Frete inválido");
  }
  for (const item of input.items) {
    if (!item.productId) throw new Error("Produto inválido");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
      throw new Error("Quantidade inválida");
    }
  }
}

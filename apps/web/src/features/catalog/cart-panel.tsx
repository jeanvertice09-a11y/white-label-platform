import { useState } from "react";
import {
  buildWhatsappCheckoutUrl,
  getCartItemCount,
  getCartTotalCents,
  removeCartItem,
  setCartItemQuantity,
} from "@white-label/catalog";
import type {
  CatalogCart,
  CatalogSettings,
} from "@white-label/catalog";
import { formatCatalogMoney } from "./view-model.ts";

export function CatalogCartPanel(props: {
  storeName: string;
  cart: CatalogCart;
  settings: CatalogSettings;
  onCartChange: (cart: CatalogCart) => void;
}): React.JSX.Element | null {
  const [error, setError] = useState("");
  const itemCount = getCartItemCount(props.cart);
  if (itemCount === 0) return null;

  function checkoutWhatsapp(): void {
    setError("");
    try {
      const url = buildWhatsappCheckoutUrl({
        storeName: props.storeName,
        cart: props.cart,
        settings: props.settings,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao iniciar pedido");
    }
  }

  return (
    <aside className="catalog-admin-form" style={{ marginTop: 28 }}>
      <CartSummary cart={props.cart} />
      {props.cart.items.map((item) => (
        <CartLine
          key={item.key}
          cart={props.cart}
          itemKey={item.key}
          onCartChange={props.onCartChange}
        />
      ))}
      <CheckoutButtons
        settings={props.settings}
        onWhatsapp={checkoutWhatsapp}
      />
      {error ? <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
    </aside>
  );
}

function CartSummary({ cart }: { cart: CatalogCart }): React.JSX.Element {
  return (
    <div className="catalog-admin-header">
      <div>
        <strong>Seu pedido</strong>
        <div className="catalog-muted">{getCartItemCount(cart)} itens</div>
      </div>
      <strong>{formatCatalogMoney(getCartTotalCents(cart))}</strong>
    </div>
  );
}

function CartLine(props: {
  cart: CatalogCart;
  itemKey: string;
  onCartChange: (cart: CatalogCart) => void;
}): React.JSX.Element | null {
  const item = props.cart.items.find((candidate) => candidate.key === props.itemKey);
  if (!item) return null;
  const scope = { tenantId: props.cart.tenantId, storeId: props.cart.storeId };

  function setQuantity(quantity: number): void {
    props.onCartChange(setCartItemQuantity(scope, props.cart, item.key, quantity));
  }

  return (
    <div className="catalog-admin-header">
      <div>
        <strong>{item.productName}</strong>
        {item.variantName ? <div className="catalog-muted">{item.variantName}</div> : null}
        <div className="catalog-muted">{formatCatalogMoney(item.unitPriceCents)} cada</div>
      </div>
      <div className="catalog-admin-actions">
        <button type="button" className="catalog-chip" onClick={() => setQuantity(Math.max(0, item.quantity - 1))}>−</button>
        <span style={{ alignSelf: "center" }}>{item.quantity}</span>
        <button type="button" className="catalog-chip" onClick={() => setQuantity(item.quantity + 1)}>+</button>
        <button
          type="button"
          className="catalog-chip"
          onClick={() => props.onCartChange(removeCartItem(scope, props.cart, item.key))}
        >
          Remover
        </button>
      </div>
    </div>
  );
}

function CheckoutButtons(props: {
  settings: CatalogSettings;
  onWhatsapp: () => void;
}): React.JSX.Element {
  const whatsapp =
    props.settings.checkoutMode === "whatsapp" ||
    props.settings.checkoutMode === "both";
  const online =
    props.settings.checkoutMode === "online" ||
    props.settings.checkoutMode === "both";

  return (
    <>
      {whatsapp ? (
        <button type="button" className="catalog-button" onClick={props.onWhatsapp}>
          Finalizar pelo WhatsApp
        </button>
      ) : null}
      {online ? (
        <button
          type="button"
          className="catalog-button catalog-button-secondary"
          disabled
          title="Pagamento online será habilitado quando o gateway da loja estiver configurado."
        >
          Pagamento online
        </button>
      ) : null}
    </>
  );
}

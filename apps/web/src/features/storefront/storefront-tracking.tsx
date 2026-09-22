import { useEffect, useRef } from "react";
import { getCatalogTrackingSettings } from "@white-label/catalog";
import type { CatalogSettings } from "@white-label/catalog";

interface TrackingItem {
  id: string;
  name?: string;
  variantName?: string | null;
  quantity?: number;
  unitPriceCents?: number;
}

export type StorefrontTrackingEvent =
  | { type: "catalog_view"; itemIds: string[] }
  | { type: "product_view"; productId: string; name: string }
  | { type: "add_to_cart"; productId: string; name: string; variantName: string | null; quantity: number; unitPriceCents: number }
  | { type: "begin_checkout"; items: TrackingItem[] }
  | { type: "order_created"; orderId: string; totalCents: number; items: TrackingItem[] };

type QueueFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
};
type TikTokQueue = unknown[] & {
  page?: (...args: unknown[]) => void;
  track?: (...args: unknown[]) => void;
  load?: (pixelId: string) => void;
  _i?: Record<string, TikTokQueue & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
};
type TrackingWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: QueueFunction;
  _fbq?: QueueFunction;
  ttq?: TikTokQueue;
};

let activeConfiguration: string | null = null;
let trackingEnabled = false;

function appendScript(key: string, source: string): void {
  if (document.querySelector(`script[data-storefront-tracker="${key}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = source;
  script.dataset.storefrontTracker = key;
  document.head.append(script);
}

function initializeMeta(pixelId: string): void {
  const target = window as TrackingWindow;
  let fbq = target.fbq;
  if (!fbq) {
    const created: QueueFunction = (...args: unknown[]) => {
      if (created.callMethod) created.callMethod(...args);
      else created.queue?.push(args);
    };
    created.queue = [];
    created.loaded = true;
    created.version = "2.0";
    fbq = created;
    target.fbq = created;
    target._fbq = created;
    appendScript("meta", "https://connect.facebook.net/en_US/fbevents.js");
  }
  fbq("init", pixelId);
}

function initializeGa4(measurementId: string): void {
  const target = window as TrackingWindow;
  const dataLayer = target.dataLayer ?? [];
  target.dataLayer = dataLayer;
  const gtag = target.gtag ?? ((...args: unknown[]) => { dataLayer.push(args); });
  target.gtag = gtag;
  appendScript("ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
  gtag("js", new Date());
  gtag("config", measurementId, { send_page_view: false });
}

function initializeTikTok(pixelId: string): void {
  const target = window as TrackingWindow;
  const emptyQueue: TikTokQueue = [];
  const queue = target.ttq ?? emptyQueue;
  target.ttq = queue;
  queue.page ??= (...args: unknown[]) => { queue.push(["page", ...args]); };
  queue.track ??= (...args: unknown[]) => { queue.push(["track", ...args]); };
  queue.load ??= (id: string) => {
    const baseUrl = "https://analytics.tiktok.com/i18n/pixel/events.js";
    const instances = queue._i ?? {};
    const instance: TikTokQueue & { _u?: string } = [];
    instance._u = baseUrl;
    instances[id] = instance;
    queue._i = instances;
    const loadedAt = queue._t ?? {};
    loadedAt[id] = Date.now();
    queue._t = loadedAt;
    const options = queue._o ?? {};
    options[id] = {};
    queue._o = options;
    appendScript("tiktok", `${baseUrl}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
  };
  queue.load(pixelId);
}

function initializeTracking(metaPixelId: string | null, ga4MeasurementId: string | null, tiktokPixelId: string | null): void {
  if (typeof window === "undefined") return;
  const signature = [metaPixelId, ga4MeasurementId, tiktokPixelId].join("|");
  if (activeConfiguration !== null && activeConfiguration !== signature) {
    trackingEnabled = false;
    return;
  }
  activeConfiguration = signature;
  trackingEnabled = Boolean(metaPixelId || ga4MeasurementId || tiktokPixelId);
  if (metaPixelId) initializeMeta(metaPixelId);
  if (ga4MeasurementId) initializeGa4(ga4MeasurementId);
  if (tiktokPixelId) initializeTikTok(tiktokPixelId);
}

function totalValue(items: TrackingItem[]): number {
  return items.reduce((total, item) => total + (item.unitPriceCents ?? 0) * (item.quantity ?? 1), 0) / 100;
}

function gaItem(item: TrackingItem): Record<string, unknown> {
  return {
    item_id: item.id,
    ...(item.name ? { item_name: item.name } : {}),
    ...(item.variantName ? { item_variant: item.variantName } : {}),
    ...(item.unitPriceCents === undefined ? {} : { price: item.unitPriceCents / 100 }),
    ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
  };
}

function sendMeta(event: StorefrontTrackingEvent): void {
  const fbq = (window as TrackingWindow).fbq;
  if (!fbq) return;
  if (event.type === "catalog_view") { fbq("track", "PageView"); return; }
  if (event.type === "product_view") { fbq("track", "ViewContent", { content_ids: [event.productId], content_name: event.name, content_type: "product" }); return; }
  if (event.type === "add_to_cart") {
    fbq("track", "AddToCart", { content_ids: [event.productId], content_name: event.name, content_type: "product", contents: [{ id: event.productId, quantity: event.quantity }], value: (event.unitPriceCents * event.quantity) / 100, currency: "BRL" });
    return;
  }
  if (event.type === "begin_checkout") { fbq("track", "InitiateCheckout", { num_items: event.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0), value: totalValue(event.items), currency: "BRL" }); return; }
  fbq("trackCustom", "OrderCreated", { contents: event.items.map((item) => ({ id: item.id, quantity: item.quantity ?? 1 })), value: event.totalCents / 100, currency: "BRL", order_id: event.orderId });
}

function sendGa4(event: StorefrontTrackingEvent): void {
  const gtag = (window as TrackingWindow).gtag;
  if (!gtag) return;
  if (event.type === "catalog_view") { gtag("event", "view_item_list", { items: event.itemIds.map((id) => ({ item_id: id })) }); return; }
  if (event.type === "product_view") { gtag("event", "view_item", { items: [{ item_id: event.productId, item_name: event.name }] }); return; }
  if (event.type === "add_to_cart") {
    const item: TrackingItem = { id: event.productId, name: event.name, variantName: event.variantName, quantity: event.quantity, unitPriceCents: event.unitPriceCents };
    gtag("event", "add_to_cart", { currency: "BRL", value: totalValue([item]), items: [gaItem(item)] });
    return;
  }
  if (event.type === "begin_checkout") { gtag("event", "begin_checkout", { currency: "BRL", value: totalValue(event.items), items: event.items.map(gaItem) }); return; }
  gtag("event", "order_created", { transaction_id: event.orderId, currency: "BRL", value: event.totalCents / 100, items: event.items.map(gaItem) });
}

function sendTikTok(event: StorefrontTrackingEvent): void {
  const ttq = (window as TrackingWindow).ttq;
  if (!ttq) return;
  if (event.type === "catalog_view") { ttq.page?.(); return; }
  if (event.type === "product_view") { ttq.track?.("ViewContent", { content_ids: [event.productId], content_name: event.name, content_type: "product" }); return; }
  if (event.type === "add_to_cart") {
    ttq.track?.("AddToCart", { content_ids: [event.productId], content_name: event.name, content_type: "product", quantity: event.quantity, value: (event.unitPriceCents * event.quantity) / 100, currency: "BRL" });
    return;
  }
  if (event.type === "begin_checkout") { ttq.track?.("InitiateCheckout", { quantity: event.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0), value: totalValue(event.items), currency: "BRL" }); return; }
  ttq.track?.("PlaceAnOrder", { value: event.totalCents / 100, currency: "BRL", content_ids: event.items.map((item) => item.id) });
}

export function trackStorefrontEvent(event: StorefrontTrackingEvent): void {
  if (typeof window === "undefined" || !trackingEnabled) return;
  sendMeta(event);
  sendGa4(event);
  sendTikTok(event);
}

function eventKey(event: StorefrontTrackingEvent): string {
  if (event.type === "catalog_view") return `${event.type}:${event.itemIds.join(",")}`;
  if (event.type === "product_view" || event.type === "add_to_cart") return `${event.type}:${event.productId}`;
  if (event.type === "order_created") return `${event.type}:${event.orderId}`;
  return event.type;
}

export function StorefrontTracking(props: Readonly<{ settings: CatalogSettings; initialEvent: StorefrontTrackingEvent }>): null {
  const tracking = getCatalogTrackingSettings(props.settings);
  const eventRef = useRef(props.initialEvent);
  eventRef.current = props.initialEvent;
  const key = eventKey(props.initialEvent);
  useEffect(() => {
    initializeTracking(tracking.metaPixelId, tracking.ga4MeasurementId, tracking.tiktokPixelId);
    trackStorefrontEvent(eventRef.current);
  }, [key, tracking.ga4MeasurementId, tracking.metaPixelId, tracking.tiktokPixelId]);
  return null;
}

export const storefrontResponsiveTheme = `
/* Agent 02 responsive layer. Store theme variables remain authoritative. */
.sf { overflow-x:clip; }
.sf :where(.sf__header-inner,.sf__main,.sf__footer,.sf__product-layout,.sf__toolbar,.sf__search-area,.sf__grid,.sf__product-card,.sf__product-link,.sf__card-body,.sf__detail,.sf__gallery,.sf__panel,.sf__cart-row,.sf__cart-copy,.sf__cart-side,.sf__checkout,.sf__checkout-fields,.sf__summary,.sf__summary-row) { min-width:0; max-width:100%; }
.sf :where(img,video,canvas,svg) { max-width:100%; }
.sf :where(.sf__logo,.sf__product-name,.sf__description,.sf__card-description,.sf__meta,.sf__variant,.sf__summary-row,.sf__cart-copy,.sf__cart-side,.sf__footer) { overflow-wrap:anywhere; }
.sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:min(1480px,calc(100% - 48px)); }
.sf__banner img { width:100%; max-width:100%; height:auto; min-height:clamp(120px,20vw,360px); max-height:460px; object-fit:cover; }
.sf__search-area { min-width:0; }
.sf__suggestions { max-height:min(52dvh,420px); overflow:auto; overscroll-behavior:contain; }
.sf__suggestion { min-width:0; }
.sf__suggestion span,.sf__suggestion small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sf__category-list { overscroll-behavior-inline:contain; scroll-snap-type:x proximity; }
.sf__category-list a { scroll-snap-align:start; }
.sf__image,.sf__detail-image { contain:layout paint; }
.sf__image img,.sf__detail-image img,.sf__thumbs img { max-width:100%; }
.sf__modal { max-width:min(100% - 24px,900px); max-height:min(92dvh,920px); overscroll-behavior:contain; }
.sf__cart-modal { max-width:min(100%,560px); }
.sf__field textarea { width:100%; min-height:96px; resize:vertical; border:1px solid #d7d7d2; border-radius:5px; padding:10px; background:#fff; color:var(--sf-ink); }
.sf__field :where(input,textarea,select):focus { border-color:var(--sf-primary,#7b5ea7); box-shadow:0 0 0 3px color-mix(in srgb,var(--sf-primary,#7b5ea7) 14%,transparent); outline:0; }
.sf__cart-copy strong,.sf__summary-row span,.sf__order-items span { min-width:0; overflow-wrap:anywhere; }
.sf__checkout-actions { z-index:2; }
.sf__primary,.sf__cart-button,.sf__close,.sf__qty button,.sf__pagination button,.sf__variant,.sf__suggestion { touch-action:manipulation; }

@media (min-width:1280px) {
  .sf__main { padding-top:36px; padding-bottom:84px; }
  .sf__grid { gap:38px 22px; }
  .sf__detail { grid-template-columns:minmax(0,1.35fr) minmax(360px,.65fr); gap:clamp(52px,6vw,96px); }
  .sf__panel { top:104px; }
}

@media (min-width:1600px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:min(1560px,calc(100% - 96px)); }
  .sf__intro { max-width:820px; }
  .sf__intro h1 { font-size:clamp(48px,3.4vw,64px); }
}

@media (max-width:1024px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:min(100% - 36px,1480px); }
  .sf__detail { grid-template-columns:minmax(0,1fr) minmax(300px,.78fr); gap:30px; }
  .sf__panel { top:86px; }
  .sf__grid { gap:28px 14px; }
}

@media (max-width:768px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:min(100% - 28px,1480px); }
  .sf__header-inner { min-height:60px; gap:10px; }
  .sf__logo { max-width:min(58vw,360px); margin-right:auto; }
  .sf__nav { display:none; }
  .sf__cart-button { min-width:44px; min-height:44px; justify-content:center; }
  .sf__main { padding-top:16px; padding-bottom:48px; }
  .sf__banner { margin-bottom:22px; border-radius:10px; }
  .sf__banner img { aspect-ratio:16/7; min-height:120px; }
  .sf__intro { padding:8px 0 26px; }
  .sf__intro h1 { font-size:clamp(32px,9vw,42px); overflow-wrap:anywhere; }
  .sf__section-head { align-items:flex-start; }
  .sf__categories { padding-bottom:28px; }
  .sf__category-list { margin-inline:-14px; padding-inline:14px; }
  .sf__toolbar { display:grid; grid-template-columns:1fr; align-items:stretch; gap:9px; }
  .sf__search-area,.sf__search-wrap,.sf__sort { width:100%; max-width:none; }
  .sf__search,.sf__select { min-height:46px; font-size:16px; }
  .sf__suggestions { inset:calc(100% + 5px) 0 auto; border-radius:10px; }
  .sf__grid,.sf__grid.sf__grid--columns-2,.sf__grid.sf__grid--columns-3,.sf__grid.sf__grid--columns-4 { grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px 12px; }
  .sf__product-name { min-height:2.7em; }
  .sf__card-foot { align-items:flex-start; flex-direction:column; gap:3px; }
  .sf__product-layout { padding:18px 0 40px; }
  .sf__detail { grid-template-columns:1fr; gap:22px; }
  .sf__panel { position:static; gap:16px; }
  .sf__detail-image { max-height:min(88vw,640px); }
  .sf__product-title { font-size:clamp(29px,8.5vw,38px); }
  .sf__variant-options { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .sf__variant { min-height:58px; overflow-wrap:anywhere; }
  .sf__attributes { grid-template-columns:1fr; }
  .sf__quantity-block { min-height:48px; }
  .sf__qty button,.sf__qty--large button { width:44px; height:44px; }
  .sf__primary { min-height:50px; }
  .sf__overlay { place-items:end center; padding:0; }
  .sf__modal { width:100%; max-width:100%; max-height:94dvh; border-radius:16px 16px 0 0; padding:18px 16px max(18px,env(safe-area-inset-bottom)); }
  .sf__cart-modal { height:auto; min-height:min(72dvh,640px); max-height:96dvh; }
  .sf__modal-head { position:sticky; top:-18px; z-index:4; margin-inline:-16px; padding:16px; background:rgba(255,255,255,.97); backdrop-filter:blur(12px); }
  .sf__close { width:44px; height:44px; }
  .sf__cart-row { gap:12px; }
  .sf__checkout-actions { position:sticky; bottom:calc(-1 * max(18px,env(safe-area-inset-bottom))); margin:4px -16px calc(-1 * max(18px,env(safe-area-inset-bottom))); padding:12px 16px max(12px,env(safe-area-inset-bottom)); border-top:1px solid var(--sf-line); background:rgba(255,255,255,.97); backdrop-filter:blur(12px); }
  .sf__checkout-actions .sf__primary { flex:1; }
  .sf__footer { flex-direction:column; gap:5px; padding-bottom:max(28px,env(safe-area-inset-bottom)); }
}

@media (max-width:430px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:calc(100% - 24px); }
  .sf__logo { max-width:56vw; }
  .sf__cart-button { padding-inline:10px; }
  .sf__cart-button span { display:none; }
  .sf__section-head { display:grid; grid-template-columns:1fr; }
  .sf__product-name { font-size:14px; }
  .sf__card-body { padding-top:9px; }
  .sf__price-line { gap:4px 6px; }
  .sf__price { font-size:14px; }
  .sf__variant-options { grid-template-columns:1fr; }
  .sf__cart-row { grid-template-columns:minmax(0,1fr) auto; }
  .sf__cart-side { min-width:92px; }
  .sf__checkout-section-head { align-items:flex-start; flex-direction:column; gap:2px; }
  .sf__checkout-actions { align-items:stretch; flex-direction:column-reverse; }
  .sf__checkout-actions :where(.sf__primary,.sf__text-button) { width:100%; justify-content:center; min-height:46px; }
  .sf__summary-row { gap:10px; }
  .sf__summary-row strong { flex:none; }
}

@media (max-width:375px) {
  .sf__grid,.sf__grid.sf__grid--columns-2,.sf__grid.sf__grid--columns-3,.sf__grid.sf__grid--columns-4 { gap:22px 9px; }
  .sf__card-foot { font-size:10.5px; }
  .sf__cart-row { grid-template-columns:1fr; }
  .sf__cart-side { min-width:0; display:flex; align-items:center; justify-content:space-between; justify-items:stretch; gap:10px; }
  .sf__cart-side > strong { order:2; }
  .sf__qty { order:1; }
  .sf__text-button { min-height:38px; display:inline-flex; align-items:center; }
}

@media (max-width:350px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:calc(100% - 20px); }
  .sf__grid,.sf__grid.sf__grid--columns-2,.sf__grid.sf__grid--columns-3,.sf__grid.sf__grid--columns-4 { grid-template-columns:1fr; gap:22px; }
  .sf__product-name { min-height:0; font-size:15px; }
  .sf__image { aspect-ratio:4/5; }
  .sf--classic .sf__image { aspect-ratio:1/1; }
  .sf__pagination { gap:8px; justify-content:space-between; }
  .sf__pagination button { min-width:0; padding-inline:10px; }
}

@media (prefers-reduced-motion:reduce) {
  .sf__category-list { scroll-behavior:auto; }
}
`;

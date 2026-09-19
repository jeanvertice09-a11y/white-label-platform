export const storefrontTheme = `
.sf {
  --sf-ink:#171717; --sf-muted:#6b6b6b; --sf-line:#e6e6e3; --sf-soft:#f5f5f2; --sf-surface:#fff;
  min-height:100vh; color:var(--sf-ink); background:var(--sf-bg,#fff); font-family:var(--sf-font,Inter,system-ui,sans-serif); font-size:15px; line-height:1.5;
}
.sf *, .sf *::before, .sf *::after { box-sizing:border-box; }
.sf a { color:inherit; }
.sf button,.sf input,.sf select { font:inherit; }
.sf button,.sf a,.sf input,.sf select { -webkit-tap-highlight-color:transparent; }
.sf :focus-visible { outline:3px solid color-mix(in srgb,var(--sf-primary,#111) 32%,transparent); outline-offset:2px; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.sf__header { position:sticky; top:0; z-index:30; border-bottom:1px solid var(--sf-line); background:color-mix(in srgb,var(--sf-bg,#fff) 92%,#fff); backdrop-filter:blur(16px); }
.sf__header-inner { width:min(1240px,calc(100% - 40px)); min-height:68px; margin:0 auto; display:flex; align-items:center; gap:32px; }
.sf__logo { max-width:42vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-decoration:none; font-size:18px; font-weight:650; letter-spacing:-.025em; }
.sf__nav { display:flex; gap:22px; margin-left:auto; }
.sf__nav a { color:var(--sf-muted); text-decoration:none; font-size:14px; }
.sf__nav a:hover { color:var(--sf-ink); }
.sf__cart-button { min-height:40px; display:inline-flex; align-items:center; gap:9px; border:1px solid var(--sf-ink); border-radius:6px; padding:8px 11px; background:var(--sf-ink); color:#fff; cursor:pointer; }
.sf__cart-button strong { min-width:20px; height:20px; display:grid; place-items:center; border-radius:10px; background:#fff; color:var(--sf-ink); font-size:11px; }
.sf__main { width:min(1240px,calc(100% - 40px)); margin:0 auto; padding:28px 0 64px; }
.sf__banner { display:block; overflow:hidden; margin-bottom:34px; border:1px solid var(--sf-line); border-radius:8px; background:var(--sf-soft); }
.sf__banner img { width:100%; max-height:430px; aspect-ratio:2.7/1; display:block; object-fit:cover; }
.sf__intro { max-width:720px; padding:16px 0 38px; }
.sf__intro h1 { margin:6px 0 0; font-size:clamp(34px,5vw,58px); line-height:1.02; font-weight:560; letter-spacing:-.05em; }
.sf__intro p { max-width:620px; margin:14px 0 0; color:var(--sf-muted); font-size:16px; }
.sf__eyebrow { display:block; color:var(--sf-muted); font-size:11px; font-weight:650; letter-spacing:.09em; text-transform:uppercase; }
.sf__categories { padding:0 0 42px; }
.sf__section-head { display:flex; align-items:end; justify-content:space-between; gap:20px; margin-bottom:18px; }
.sf__section-head h2 { margin:4px 0 0; font-size:22px; font-weight:600; letter-spacing:-.03em; }
.sf__section-head p { margin:4px 0 0; color:var(--sf-muted); font-size:13px; }
.sf__category-list { display:flex; gap:0; overflow-x:auto; border-bottom:1px solid var(--sf-line); scrollbar-width:none; }
.sf__category-list::-webkit-scrollbar { display:none; }
.sf__category-list a { flex:none; padding:10px 16px 11px 0; margin-right:20px; border-bottom:2px solid transparent; color:var(--sf-muted); text-decoration:none; white-space:nowrap; font-size:14px; }
.sf__category-list a:hover,.sf__category-list a.is-active { color:var(--sf-ink); border-color:var(--sf-primary,#111); }
.sf__products { scroll-margin-top:90px; }
.sf__toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:24px; }
.sf__search-wrap { flex:1; max-width:420px; }
.sf__search,.sf__select { width:100%; min-height:42px; border:1px solid #d7d7d2; border-radius:5px; padding:9px 11px; background:#fff; color:var(--sf-ink); }
.sf__search::placeholder { color:#969690; }
.sf__sort { width:auto; min-width:154px; }
.sf__grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:32px 18px; }
.sf__product-card { min-width:0; }
.sf__product-link { display:block; text-decoration:none; }
.sf__image { aspect-ratio:4/5; display:grid; place-items:center; overflow:hidden; background:var(--sf-soft); }
.sf--classic .sf__image { aspect-ratio:1/1; }
.sf__image img { width:100%; height:100%; display:block; object-fit:cover; transition:transform .24s ease; }
.sf__product-link:hover .sf__image img { transform:scale(1.018); }
.sf__placeholder { color:#90908a; font-size:12px; text-align:center; padding:14px; }
.sf__card-body { padding:12px 1px 0; }
.sf__meta { display:block; color:var(--sf-muted); font-size:12px; }
.sf__product-name { margin:4px 0 8px; font-size:15px; line-height:1.35; font-weight:540; letter-spacing:-.012em; }
.sf__price-line { display:flex; align-items:baseline; flex-wrap:wrap; gap:7px; }
.sf__price-line--detail { margin:4px 0 2px; }
.sf__old-price { color:#8c8c86; text-decoration:line-through; font-size:13px; }
.sf__price { color:var(--sf-ink); font-size:15px; font-weight:650; }
.sf__price-line--detail .sf__price { font-size:25px; letter-spacing:-.025em; }
.sf__price--pending { color:var(--sf-muted); }
.sf__card-foot { min-height:22px; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:7px; color:var(--sf-muted); font-size:11px; }
.sf__availability { color:#8a2e25; font-weight:600; }
.sf__empty { grid-column:1/-1; display:grid; gap:5px; justify-items:start; padding:42px 0; border-top:1px solid var(--sf-line); color:var(--sf-muted); }
.sf__empty strong { color:var(--sf-ink); font-size:16px; }
.sf__empty--cart { border:0; padding:38px 0; }
.sf__product-skeleton { display:grid; gap:10px; }
.sf__product-skeleton span { aspect-ratio:4/5; background:#efefeb; animation:sf-pulse 1.2s ease-in-out infinite alternate; }
.sf__product-skeleton i { width:72%; height:12px; background:#efefeb; }
.sf__product-skeleton i:last-child { width:42%; }
.sf__pagination { display:flex; justify-content:center; align-items:center; gap:16px; margin:38px 0 0; color:var(--sf-muted); font-size:13px; }
.sf__pagination button { min-height:40px; border:1px solid #d7d7d2; border-radius:5px; padding:8px 13px; background:#fff; cursor:pointer; }
.sf__pagination button:disabled { opacity:.42; cursor:not-allowed; }
.sf__footer { width:min(1240px,calc(100% - 40px)); margin:0 auto; display:flex; justify-content:space-between; gap:20px; padding:28px 0 36px; border-top:1px solid var(--sf-line); color:var(--sf-muted); font-size:12px; }
.sf__footer strong { color:var(--sf-ink); font-weight:600; }
.sf__overlay { position:fixed; inset:0; z-index:60; display:grid; place-items:center; padding:20px; background:rgba(20,20,20,.42); }
.sf__overlay--drawer { place-items:stretch end; padding:0; }
.sf__modal { width:min(900px,100%); max-height:92vh; overflow:auto; border-radius:10px; padding:22px; background:#fff; box-shadow:0 18px 60px rgba(0,0,0,.18); }
.sf__cart-modal { width:min(520px,100%); height:100%; max-height:none; border-radius:0; padding:24px; }
.sf__modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding-bottom:18px; border-bottom:1px solid var(--sf-line); }
.sf__modal-head h2 { margin:4px 0 0; font-size:24px; font-weight:600; letter-spacing:-.035em; }
.sf__close { width:40px; height:40px; flex:none; border:1px solid var(--sf-line); border-radius:5px; background:#fff; color:var(--sf-ink); cursor:pointer; font-size:22px; }
.sf__product-layout { width:min(1240px,calc(100% - 40px)); margin:0 auto; padding:38px 0 72px; }
.sf__detail { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(340px,.8fr); gap:clamp(32px,6vw,80px); align-items:start; }
.sf__gallery { min-width:0; }
.sf__detail-image { aspect-ratio:1/1; display:grid; place-items:center; overflow:hidden; background:var(--sf-soft); }
.sf__detail-image img { width:100%; height:100%; display:block; object-fit:cover; }
.sf__thumbs { display:flex; gap:8px; overflow:auto; padding-top:10px; }
.sf__thumbs button { width:68px; height:68px; flex:none; padding:2px; border:1px solid var(--sf-line); border-radius:4px; background:#fff; cursor:pointer; }
.sf__thumbs button[data-active="true"] { border-color:var(--sf-ink); }
.sf__thumbs img { width:100%; height:100%; display:block; object-fit:cover; }
.sf__panel { display:grid; gap:18px; align-content:start; position:sticky; top:96px; }
.sf__product-title { margin:0; font-size:clamp(29px,4vw,44px); line-height:1.06; font-weight:560; letter-spacing:-.045em; }
.sf__description { margin:0; color:#55554f; line-height:1.7; white-space:pre-line; }
.sf__variants { min-width:0; margin:2px 0 0; padding:18px 0 0; border:0; border-top:1px solid var(--sf-line); }
.sf__variants legend { padding:0; margin-bottom:10px; font-size:13px; font-weight:650; }
.sf__variant-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.sf__variant { min-height:54px; display:grid; gap:2px; text-align:left; border:1px solid #d7d7d2; border-radius:5px; padding:9px 10px; background:#fff; color:var(--sf-ink); cursor:pointer; }
.sf__variant small { color:var(--sf-muted); }
.sf__variant[data-selected="true"] { border-color:var(--sf-primary,#111); box-shadow:inset 0 0 0 1px var(--sf-primary,#111); }
.sf__variant[data-unavailable="true"] { color:#989892; background:#f7f7f4; text-decoration:line-through; cursor:not-allowed; }
.sf__attributes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 14px; margin:0; padding:12px 0; border-top:1px solid var(--sf-line); border-bottom:1px solid var(--sf-line); }
.sf__attributes div { display:flex; justify-content:space-between; gap:10px; }
.sf__attributes dt { color:var(--sf-muted); text-transform:capitalize; }
.sf__attributes dd { margin:0; font-weight:550; }
.sf__stock { margin:0; color:#6d332c; font-size:13px; }
.sf__stock[data-available="true"] { color:#2b6748; }
.sf__quantity-block { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.sf__quantity-block > span { font-size:13px; font-weight:650; }
.sf__qty { display:flex; align-items:center; border:1px solid #d7d7d2; border-radius:5px; overflow:hidden; }
.sf__qty button { width:34px; height:34px; border:0; background:#fff; cursor:pointer; }
.sf__qty button:disabled { color:#bbb; cursor:not-allowed; }
.sf__qty span,.sf__qty output { min-width:32px; text-align:center; font-size:13px; }
.sf__qty--large button { width:40px; height:40px; }
.sf__primary { min-height:46px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--sf-ink); border-radius:5px; padding:11px 16px; background:var(--sf-ink); color:#fff; font-weight:650; text-decoration:none; cursor:pointer; }
.sf__primary:hover { background:#000; }
.sf__primary:disabled { opacity:.45; cursor:not-allowed; }
.sf__add { width:100%; min-height:50px; }
.sf__cart-list { display:grid; }
.sf__cart-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; padding:18px 0; border-bottom:1px solid var(--sf-line); }
.sf__cart-copy { display:grid; align-content:start; gap:3px; min-width:0; }
.sf__cart-side { display:grid; justify-items:end; align-content:space-between; gap:14px; }
.sf__text-button { width:max-content; border:0; padding:4px 0; background:transparent; color:var(--sf-muted); text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
.sf__checkout { display:grid; gap:20px; padding-top:22px; }
.sf__checkout-fields { display:grid; gap:12px; }
.sf__checkout-section-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
.sf__checkout-section-head span { font-weight:650; }
.sf__checkout-section-head small { color:var(--sf-muted); }
.sf__field { display:grid; gap:6px; font-size:13px; }
.sf__field > span { font-weight:600; }
.sf__field > span small { color:var(--sf-muted); font-weight:400; }
.sf__field input { width:100%; min-height:43px; border:1px solid #d7d7d2; border-radius:5px; padding:9px 10px; background:#fff; }
.sf__coupon { margin-top:4px; padding-top:16px; border-top:1px solid var(--sf-line); }
.sf__summary { display:grid; gap:8px; padding:16px 0; border-top:1px solid var(--sf-line); border-bottom:1px solid var(--sf-line); }
.sf__summary p { margin:6px 0 0; color:var(--sf-muted); font-size:11px; line-height:1.5; }
.sf__summary-row { display:flex; justify-content:space-between; gap:18px; font-size:13px; }
.sf__summary-row--total { font-size:17px; }
.sf__checkout-error { padding:11px 12px; border-left:3px solid #9a4b3f; background:#fbf2ef; color:#6f2f27; font-size:13px; }
.sf__checkout-actions { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.sf__success { display:grid; gap:22px; padding-top:24px; }
.sf__confirmation-head { display:flex; align-items:flex-start; gap:14px; }
.sf__confirmation-head h3 { margin:3px 0 6px; font-size:24px; }
.sf__confirmation-head p { margin:0; color:var(--sf-muted); }
.sf__success-mark { width:38px; height:38px; flex:none; display:grid; place-items:center; border:1px solid #a9d0b8; border-radius:50%; color:#286343; }
.sf__order-items { display:grid; gap:8px; }
.sf-state { min-height:70vh; width:min(720px,calc(100% - 40px)); margin:0 auto; display:grid; align-content:center; gap:8px; font-family:Inter,system-ui,sans-serif; color:#171717; }
.sf-state h1 { margin:0; font-size:30px; letter-spacing:-.04em; }
.sf-state p { margin:0; color:#6b6b6b; }
.sf-state__skeleton { width:min(480px,100%); height:34px; background:#efefeb; animation:sf-pulse 1.2s ease-in-out infinite alternate; }
.sf-state__skeleton--short { width:min(300px,70%); height:16px; }
@keyframes sf-pulse { from { opacity:.55; } to { opacity:1; } }
@media (max-width:980px) { .sf__grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .sf__detail { gap:32px; } }
@media (max-width:760px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:min(100% - 28px,1240px); }
  .sf__header-inner { min-height:60px; gap:14px; }
  .sf__nav { display:none; }
  .sf__logo { margin-right:auto; }
  .sf__main { padding-top:18px; }
  .sf__banner { margin-bottom:24px; }
  .sf__banner img { aspect-ratio:16/7; }
  .sf__intro { padding:10px 0 28px; }
  .sf__intro h1 { font-size:36px; }
  .sf__categories { padding-bottom:32px; }
  .sf__toolbar { align-items:stretch; flex-direction:column; }
  .sf__search-wrap { max-width:none; }
  .sf__sort { width:100%; }
  .sf__grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:26px 10px; }
  .sf__product-layout { padding:20px 0 48px; }
  .sf__detail { grid-template-columns:1fr; gap:24px; }
  .sf__panel { position:static; }
  .sf__product-title { font-size:32px; }
  .sf__variant-options { grid-template-columns:1fr; }
  .sf__overlay { place-items:end center; padding:0; }
  .sf__modal { width:100%; max-height:94vh; border-radius:10px 10px 0 0; padding:18px 16px; }
  .sf__cart-modal { height:94vh; border-radius:10px 10px 0 0; }
  .sf__footer { flex-direction:column; gap:3px; }
}
@media (max-width:390px) {
  .sf__header-inner,.sf__main,.sf__footer,.sf__product-layout { width:calc(100% - 22px); }
  .sf__cart-button span { display:none; }
  .sf__grid { gap-left:8px; gap-right:8px; }
  .sf__card-body { padding-top:9px; }
  .sf__product-name { font-size:14px; }
  .sf__price { font-size:14px; }
  .sf__checkout-actions { align-items:stretch; flex-direction:column-reverse; }
  .sf__checkout-actions .sf__primary { width:100%; }
}
@media (prefers-reduced-motion:reduce) { .sf *, .sf *::before, .sf *::after { scroll-behavior:auto !important; transition:none !important; animation:none !important; } }
`;

export const storefrontTheme = `
.sf {
  min-height: 70vh;
  color: #18212f;
  background: var(--sf-bg, #fff);
  font-family: var(--sf-font, system-ui, sans-serif);
}
.sf__hero { display:grid; gap:16px; margin-bottom:24px; }
.sf__brand { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
.sf__brand h1 { margin:0; font-size:clamp(28px,5vw,46px); letter-spacing:-.045em; }
.sf__brand p { margin:6px 0 0; color:#667085; }
.sf__banner { overflow:hidden; border-radius:18px; background:#f4f6f8; border:1px solid #e7eaee; }
.sf__banner img { width:100%; max-height:360px; display:block; object-fit:cover; }
.sf__toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:20px; }
.sf__search { flex:1 1 260px; border:1px solid #d8dde5; border-radius:12px; padding:11px 13px; font:inherit; }
.sf__chips { display:flex; gap:7px; overflow-x:auto; padding-bottom:2px; }
.sf__chip { border:1px solid #d8dde5; background:#fff; border-radius:999px; padding:8px 11px; white-space:nowrap; cursor:pointer; }
.sf__chip[data-active="true"] { background:var(--sf-primary,#111827); border-color:var(--sf-primary,#111827); color:#fff; }
.sf__grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
.sf--modern .sf__grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
.sf__card { border:1px solid #e5e9ef; background:#fff; border-radius:16px; overflow:hidden; cursor:pointer; text-align:left; padding:0; color:inherit; font:inherit; }
.sf--modern .sf__card { border-radius:24px; box-shadow:0 10px 30px rgba(15,23,42,.06); }
.sf__image { aspect-ratio:4/3; background:#f4f6f8; display:grid; place-items:center; overflow:hidden; }
.sf--modern .sf__image { aspect-ratio:1/1; }
.sf__image img { width:100%; height:100%; object-fit:cover; display:block; }
.sf__placeholder { color:#98a2b3; font-size:13px; }
.sf__card-body { padding:14px; display:grid; gap:8px; }
.sf__product-name { font-weight:720; line-height:1.3; }
.sf__meta { color:#667085; font-size:13px; }
.sf__price { font-size:18px; font-weight:760; color:var(--sf-primary,#111827); }
.sf__empty { border:1px dashed #cfd5de; border-radius:16px; padding:42px 20px; text-align:center; color:#667085; grid-column:1/-1; }
.sf__cart-button { border:0; border-radius:999px; background:var(--sf-primary,#111827); color:#fff; padding:10px 14px; font:inherit; font-weight:700; cursor:pointer; }
.sf__overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); display:grid; place-items:center; z-index:50; padding:18px; }
.sf__modal { width:min(780px,100%); max-height:90vh; overflow:auto; background:#fff; border-radius:20px; padding:20px; box-shadow:0 24px 70px rgba(15,23,42,.25); }
.sf__modal-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
.sf__close { border:0; background:#f2f4f7; border-radius:999px; width:36px; height:36px; cursor:pointer; }
.sf__detail { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; margin-top:18px; }
.sf__detail-image { aspect-ratio:1/1; border-radius:16px; overflow:hidden; background:#f4f6f8; }
.sf__detail-image img { width:100%; height:100%; object-fit:cover; }
.sf__panel { display:grid; gap:14px; align-content:start; }
.sf__select { width:100%; border:1px solid #d8dde5; border-radius:10px; padding:10px 12px; font:inherit; background:#fff; }
.sf__primary { border:0; border-radius:10px; background:var(--sf-primary,#111827); color:#fff; padding:11px 14px; font:inherit; font-weight:700; cursor:pointer; }
.sf__primary:disabled { opacity:.6; cursor:not-allowed; }
.sf__cart { display:grid; gap:12px; }
.sf__cart-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; padding:12px 0; border-bottom:1px solid #eef1f4; }
.sf__qty { display:flex; align-items:center; gap:8px; }
.sf__qty button { width:30px; height:30px; border:1px solid #d8dde5; background:#fff; border-radius:8px; cursor:pointer; }
.sf__checkout { display:grid; gap:10px; margin-top:10px; }
.sf__checkout a { text-align:center; text-decoration:none; }
.sf__total { display:flex; justify-content:space-between; font-size:18px; font-weight:760; }
.sf__field { display:grid; gap:6px; font-size:13px; }
.sf__field span { font-weight:650; color:#475467; }
.sf__field input { width:100%; box-sizing:border-box; border:1px solid #d8dde5; border-radius:10px; padding:10px 11px; font:inherit; }
@media (max-width:900px) {
  .sf__grid,.sf--modern .sf__grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width:640px) {
  .sf__brand { align-items:flex-start; flex-direction:column; }
  .sf__grid,.sf--modern .sf__grid { grid-template-columns:1fr 1fr; gap:10px; }
  .sf__card-body { padding:11px; }
  .sf__detail { grid-template-columns:1fr; }
  .sf__modal { padding:16px; border-radius:16px; }
}
`;

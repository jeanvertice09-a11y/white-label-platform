export const storefrontAdvancedTheme = `
.sf__search-area { position:relative; flex:1; max-width:420px; }
.sf__search-area .sf__search-wrap { display:block; max-width:none; }
.sf__suggestions { position:absolute; inset:calc(100% + 6px) 0 auto; z-index:25; display:grid; padding:6px; border:1px solid var(--sf-line); border-radius:6px; background:#fff; box-shadow:0 12px 30px rgba(0,0,0,.09); }
.sf__suggestion { display:grid; gap:1px; width:100%; border:0; border-radius:4px; padding:8px 9px; background:#fff; color:var(--sf-ink); text-align:left; cursor:pointer; }
.sf__suggestion:hover { background:var(--sf-soft); }
.sf__suggestion small { color:var(--sf-muted); }
.sf__grid.sf__grid--columns-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
.sf__grid.sf__grid--columns-3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
.sf__grid.sf__grid--columns-4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
.sf__product-card--compact .sf__image { aspect-ratio:1/1; }
.sf__product-card--compact .sf__card-body { padding-top:8px; }
.sf__card-description { display:-webkit-box; margin:6px 0 0; overflow:hidden; color:var(--sf-muted); font-size:12px; line-height:1.45; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
.sf__minimum-order { margin:0; color:var(--sf-muted); font-size:12px; }
.sf__minimum-order[data-met="false"] { color:#8a2e25; font-weight:600; }
@media (max-width:780px) {
  .sf__grid.sf__grid--columns-2,.sf__grid.sf__grid--columns-3,.sf__grid.sf__grid--columns-4 { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width:460px) {
  .sf__grid.sf__grid--columns-2,.sf__grid.sf__grid--columns-3,.sf__grid.sf__grid--columns-4 { gap:24px 10px; }
}
`;

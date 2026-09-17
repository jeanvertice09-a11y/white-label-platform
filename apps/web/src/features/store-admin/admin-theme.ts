export const adminTheme = `
:root { color-scheme: light; }
.k-admin { min-height: 70vh; color: #17202a; }
.k-admin__top { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; }
.k-admin__brand { display:flex; flex-direction:column; gap:3px; }
.k-admin__eyebrow { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#7b8794; font-weight:700; }
.k-admin__title { margin:0; font-size:24px; letter-spacing:-.025em; }
.k-admin__nav { display:flex; flex-wrap:wrap; gap:6px; padding:5px; background:#f4f6f8; border:1px solid #e7eaee; border-radius:12px; margin-bottom:28px; }
.k-admin__nav a { color:#52606d; text-decoration:none; font-size:14px; font-weight:600; padding:8px 11px; border-radius:8px; }
.k-admin__nav a[data-status="active"] { background:#fff; color:#111827; box-shadow:0 1px 3px rgba(15,23,42,.08); }
.k-page { display:grid; gap:20px; }
.k-page__head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.k-page__head h1 { margin:0; font-size:28px; letter-spacing:-.035em; }
.k-page__head p { margin:6px 0 0; color:#6b7280; max-width:650px; line-height:1.55; }
.k-button { appearance:none; border:1px solid #d8dde5; background:#fff; color:#18212f; padding:9px 13px; border-radius:9px; font:inherit; font-weight:650; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:7px; }
.k-button:hover { background:#f8fafc; }
.k-button--primary { background:#111827; border-color:#111827; color:#fff; }
.k-button--primary:hover { background:#252f3f; }
.k-button:disabled { opacity:.55; cursor:not-allowed; }
.k-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.k-card { background:#fff; border:1px solid #e5e9ef; border-radius:14px; padding:18px; box-shadow:0 1px 2px rgba(15,23,42,.025); }
.k-card h2,.k-card h3 { margin:0 0 8px; }
.k-stat__label { color:#6b7280; font-size:13px; font-weight:600; }
.k-stat__value { font-size:28px; font-weight:750; letter-spacing:-.04em; margin-top:6px; }
.k-table { width:100%; border-collapse:collapse; font-size:14px; }
.k-table th { text-align:left; padding:10px 12px; color:#697586; font-size:12px; text-transform:uppercase; letter-spacing:.045em; border-bottom:1px solid #e6eaf0; }
.k-table td { padding:13px 12px; border-bottom:1px solid #eef1f4; vertical-align:middle; }
.k-table tr:last-child td { border-bottom:0; }
.k-muted { color:#6b7280; }
.k-badge { display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; background:#f1f5f9; color:#475569; font-size:12px; font-weight:650; }
.k-badge--on { background:#ecfdf3; color:#067647; }
.k-empty { text-align:center; padding:42px 20px; border:1px dashed #ccd3dc; border-radius:14px; color:#667085; }
.k-form { display:grid; gap:18px; }
.k-form__grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.k-field { display:grid; gap:7px; }
.k-field--full { grid-column:1/-1; }
.k-field label { font-size:13px; font-weight:650; color:#344054; }
.k-field input,.k-field textarea,.k-field select { width:100%; box-sizing:border-box; border:1px solid #d8dde5; border-radius:9px; padding:10px 11px; background:#fff; color:#17202a; font:inherit; outline:none; }
.k-field input:focus,.k-field textarea:focus,.k-field select:focus { border-color:#8a94a3; box-shadow:0 0 0 3px rgba(17,24,39,.06); }
.k-field textarea { min-height:100px; resize:vertical; }
.k-check { display:flex; align-items:center; gap:9px; font-size:14px; color:#344054; }
.k-check input { width:16px; height:16px; }
.k-actions { display:flex; justify-content:flex-end; gap:10px; padding-top:4px; }
.k-status { font-size:13px; color:#667085; }
.k-danger { color:#b42318; }
.k-stack { display:grid; gap:12px; }
.k-row { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.k-row__main { min-width:0; }
.k-row__title { font-weight:680; }
.k-row__meta { color:#748091; font-size:13px; margin-top:3px; }
.k-preview { border-radius:14px; border:1px solid #e1e6ec; overflow:hidden; background:#fff; }
.k-preview__bar { height:8px; background:var(--preview-primary,#111827); }
.k-preview__body { padding:20px; background:var(--preview-bg,#fff); }
.k-preview__accent { color:var(--preview-accent,#2563eb); font-weight:700; }
@media (max-width: 760px) {
  .k-admin__top,.k-page__head,.k-row { align-items:stretch; flex-direction:column; }
  .k-grid,.k-form__grid { grid-template-columns:1fr; }
  .k-field--full { grid-column:auto; }
  .k-table { min-width:640px; }
  .k-table-wrap { overflow-x:auto; }
  .k-admin__nav { overflow-x:auto; flex-wrap:nowrap; }
}
`;

import type { ReactNode, SVGProps } from "react";

export type DashboardIconName =
  | "home"
  | "platforms"
  | "billing"
  | "support"
  | "audit"
  | "infrastructure"
  | "settings"
  | "menu"
  | "logout"
  | "store"
  | "products"
  | "categories"
  | "orders"
  | "customers"
  | "inventory"
  | "marketing"
  | "palette"
  | "domains"
  | "integrations"
  | "subscriptions"
  | "revenue"
  | "activity"
  | "check";

const paths: Record<DashboardIconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  platforms: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></>,
  billing: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h4" /></>,
  support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM20 13h-3v6h1a2 2 0 0 0 2-2v-4ZM17 19c0 2-2 2-5 2" /></>,
  audit: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5M8 17h3" /></>,
  infrastructure: <><path d="M4 4h16v5H4zM4 15h16v5H4z" /><path d="M8 9v6M16 9v6M7 6h.01M7 17h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.4-2.6h-4L10 6a7 7 0 0 0-1.5.9l-2.4-1-2 3.4L6.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A7 7 0 0 0 10 18l.4 2.6h4L15 18a7 7 0 0 0 1.5-.9l2.4 1 2-3.4L18.9 13a7 7 0 0 0 .1-1Z" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: <><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" /><path d="m14 16 4-4-4-4M18 12H9" /></>,
  store: <><path d="M4 10h16l-2-5H6l-2 5Z" /><path d="M5 10v9h14v-9M9 19v-5h6v5" /></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 21v-8.9" /></>,
  categories: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  customers: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 16a4 4 0 0 1 6.5 4" /></>,
  inventory: <><path d="M4 6h16v14H4z" /><path d="M3 6 5 3h14l2 3M9 10h6" /></>,
  marketing: <><path d="m4 13 11-5v8L4 11v2Z" /><path d="M15 10.5c3-1 5-2.5 5-2.5v8s-2-1.5-5-2.5M6 13l1 6h3l-1-5" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z" /><path d="M7 9h.01M9 6h.01M13 6h.01M16 8h.01" /></>,
  domains: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  integrations: <><path d="M8 12h8M12 8v8" /><path d="M6 4h12v16H6z" /></>,
  subscriptions: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  revenue: <><path d="M4 18V8M10 18V4M16 18v-6M22 18H2" /><path d="m4 9 6-4 6 5 5-5" /></>,
  activity: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  check: <path d="m5 12 4 4L19 6" />,
};

export function DashboardIcon({ name, ...props }: Readonly<{ name: DashboardIconName } & SVGProps<SVGSVGElement>>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

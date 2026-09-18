import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";
import { Button } from "./Button";
import { type ButtonProps } from "./Button";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actions?: Array<ButtonProps & { children: React.ReactNode }>;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className = "",
}: PageHeaderProps) {
  const breadcrumbNav = breadcrumb && breadcrumb.length > 0 ? (
    <nav className="mb-3 flex items-center gap-2 text-sm text-[var(--color-foreground-muted)]" aria-label="Breadcrumb">
      {breadcrumb.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-[var(--color-foreground-subtle)]"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
          {item.href ? (
            <a href={item.href} className="hover:text-[var(--color-foreground)] transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="text-[var(--color-foreground)] font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  ) : null;

  const descriptionEl = description ? (
    <p className="mt-1 text-[var(--color-foreground-muted)] max-w-2xl">
      {description}
    </p>
  ) : null;

  const actionsEl = actions && actions.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {actions.map((action, index) => (
        <Button key={index} {...action}>
          {action.children}
        </Button>
      ))}
    </div>
  ) : null;

  return (
    <header className={`flex flex-col sm:flex-row sm-items-center sm-justify-between gap-4 ${className}`.trim()}>
      <div className="flex-1 min-w-0">
        {breadcrumbNav}
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
          {title}
        </h1>
        {descriptionEl}
      </div>
      {actionsEl}
    </header>
  );
}
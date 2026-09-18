import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";

export interface SidebarItemProps extends Omit<HTMLAttributes<HTMLLIElement>, "children"> {
  label: string;
  href: string;
  icon?: ReactNode | (() => ReactNode);
  badge?: string | number;
  badgeVariant?: "default" | "primary" | "success" | "warning" | "danger";
  disabled?: boolean;
  children?: ReactNode;
}

import { Badge } from "./Badge";

export const SidebarItem = forwardRef<HTMLLIElement, SidebarItemProps>(
  ({ label, href, icon, badge, badgeVariant = "default", disabled = false, children, className = "", ...props }, ref) => {
    const location = useLocation();
    const isActive = location.href.startsWith(href) && href !== "/";
    const isDisabled = disabled || !!children;

    const baseStyles = `
      group relative flex items-center gap-3
      px-3 py-2.5 rounded-lg
      text-sm font-medium
      transition-colors duration-150
      select-none
    `;

    const activeStyles = `
      bg-[var(--color-primary-muted)] text-[var(--color-primary)]
      before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--color-primary)] before:rounded-r-lg
    `;

    const inactiveStyles = `
      text-[var(--color-foreground-muted)]
      hover:bg-[var(--color-background-hover)] hover:text-[var(--color-foreground)]
    `;

    const disabledStyles = `
      opacity-40 cursor-not-allowed pointer-events-none
    `;

    const iconStyles = `
      flex-shrink-0 w-5 h-5
      transition-colors duration-150
      group-hover:text-[var(--color-foreground)]
    `;

    const renderIcon = (icon?: ReactNode | (() => ReactNode)) => {
      if (!icon) return null;
      if (typeof icon === "function") {
        return <span className={iconStyles} aria-hidden="true">{icon()}</span>;
      }
      return <span className={iconStyles} aria-hidden="true">{icon}</span>;
    };

    if (isDisabled) {
      return (
        <li ref={ref} className={className} {...props}>
          <div className={`${baseStyles} ${inactiveStyles} ${disabledStyles}`}>
            {renderIcon(icon)}
            <span>{label}</span>
            {badge !== undefined && (
              <Badge variant={badgeVariant} size="sm">
                {badge}
              </Badge>
            )}
            {children && (
              <span className="ml-auto flex items-center gap-1 text-[var(--color-foreground-subtle)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-foreground-subtle)]" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            )}
          </div>
        </li>
      );
    }

    return (
      <li ref={ref} className={className} {...props}>
        <Link
          to={href}
          className={`${baseStyles} ${isActive ? activeStyles : inactiveStyles}`}
          aria-current={isActive ? "page" : undefined}
        >
          {renderIcon(icon)}
          <span className="truncate flex-1">{label}</span>
          {badge !== undefined && (
            <Badge variant={badgeVariant} size="sm" className="ms-auto shrink-0">
              {badge}
            </Badge>
          )}
          {children && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--color-foreground-subtle)] group-has-[[aria-expanded=true]]:rotate-180 transition-transform duration-200"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </Link>
        {children && (
          <ul className="mt-1 ml-8 space-y-1 border-l border-[var(--color-border)] pl-3">
            {children}
          </ul>
        )}
      </li>
    );
  },
);

SidebarItem.displayName = "SidebarItem";
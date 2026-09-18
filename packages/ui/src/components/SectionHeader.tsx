import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action, className = "", ...props }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm-items-center sm-justify-between gap-3 ${className}`.trim()} {...props}>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--color-foreground-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0 mt-3 sm:mt-0">
          {action}
        </div>
      )}
    </div>
  );
}
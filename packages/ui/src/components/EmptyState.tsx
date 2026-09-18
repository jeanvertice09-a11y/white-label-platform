import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";
import { Button } from "./Button";
import { type ButtonProps } from "./Button";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: ButtonProps & { children: React.ReactNode };
  variant?: "default" | "minimal";
}

const _excluded = ["ref"];

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, variant = "default", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          flex flex-col items-center justify-center text-center
          ${variant === "minimal" ? "py-8" : "py-16"}
          px-4
          ${className}
        `.trim()}
        {...props}
      >
        {icon && (
          <div
            className={`
              mb-4 flex items-center justify-center
              w-16 h-16 rounded-full
              bg-[var(--color-neutral-100)] text-[var(--color-foreground-subtle)]
            `.trim()}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-[var(--color-foreground-muted)] max-w-sm mb-6">
            {description}
          </p>
        )}
        {action && (
          <Button {...action} className="w-auto">
            {action.children}
          </Button>
        )}
        {children}
      </div>
    );
  },
);

EmptyState.displayName = "EmptyState";
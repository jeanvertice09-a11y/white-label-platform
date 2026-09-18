import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "neutral";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-neutral-100)] text-[var(--color-foreground)]",
  primary: "bg-[var(--color-primary-muted)] text-[var(--color-primary-foreground)]",
  success: "bg-[var(--color-success-muted)] text-[var(--color-success-foreground)]",
  warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)]",
  danger: "bg-[var(--color-danger-muted)] text-[var(--color-danger-foreground)]",
  neutral: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

const dotStyles = {
  default: "bg-[var(--color-neutral-400)]",
  primary: "bg-[var(--color-primary-500)]",
  success: "bg-[var(--color-success-500)]",
  warning: "bg-[var(--color-warning-500)]",
  danger: "bg-[var(--color-danger-500)]",
  neutral: "bg-[var(--color-neutral-400)]",
};

const _excluded = ["ref"];

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", size = "md", dot = false, className = "", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1
          font-medium rounded-full
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `.trim()}
        {...props}
      >
        {dot && (
          <span
            className={`
              w-1.5 h-1.5 rounded-full shrink-0
              ${dotStyles[variant]}
            `.trim()}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
import { type ButtonHTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const baseStyles = `
  inline-flex items-center justify-center gap-2
  font-medium transition-all duration-150 ease-out
  rounded-lg border
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  select-none
`;

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--color-primary)] text-[var(--color-primary-foreground)]
    border-transparent
    hover:bg-[var(--color-primary-hover)]
    active:bg-[var(--color-primary-active)]
    focus-visible:ring-[var(--color-primary)]
  `,
  secondary: `
    bg-[var(--color-background-card)] text-[var(--color-foreground)]
    border-[var(--color-border)]
    hover:bg-[var(--color-background-hover)]
    active:bg-[var(--color-background-active)]
    focus-visible:ring-[var(--color-border-focus)]
  `,
  ghost: `
    bg-transparent text-[var(--color-foreground)]
    border-transparent
    hover:bg-[var(--color-background-hover)]
    active:bg-[var(--color-background-active)]
    focus-visible:ring-[var(--color-border-focus)]
  `,
  danger: `
    bg-[var(--color-danger)] text-[var(--color-danger-foreground)]
    border-transparent
    hover:bg-[var(--color-danger-hover)]
    active:bg-[var(--color-danger-active)]
    focus-visible:ring-[var(--color-danger)]
  `,
  success: `
    bg-[var(--color-success)] text-[var(--color-success-foreground)]
    border-transparent
    hover:bg-[var(--color-success-hover)]
    active:bg-[var(--color-success-active)]
    focus-visible:ring-[var(--color-success)]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-base gap-2",
  lg: "px-6 py-3 text-lg gap-2.5",
};

const iconPositionStyles = {
  left: "flex-row",
  right: "flex-row-reverse",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? "w-full" : ""}
          ${icon ? iconPositionStyles[iconPosition] : ""}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {!loading && icon && <span aria-hidden="true">{icon}</span>}
        <span>{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";

export type { ButtonProps as ButtonComponentProps };
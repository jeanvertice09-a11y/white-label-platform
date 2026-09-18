import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";
import { Button } from "./Button";
import { type ButtonProps } from "./Button";

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  action?: ButtonProps & { children: React.ReactNode };
  onRetry?: () => void;
  variant?: "default" | "inline";
}

const _excluded = ["ref"];

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ title = "Ocorreu um erro", message, action, onRetry, variant = "default", className = "", ...props }, ref) => {
    const handleRetry = () => {
      if (onRetry) onRetry();
    };

    const actionButton = action
      ? {
          ...action,
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            if (action.onClick) action.onClick(e);
          },
        }
      : onRetry
      ? ({ children: "Tentar novamente", variant: "secondary" as const, onClick: handleRetry })
      : undefined;

    return (
      <div
        ref={ref}
        className={`
          flex flex-col items-center justify-center text-center gap-4
          ${variant === "inline" ? "py-6 px-4" : "py-16 px-4"}
          ${className}
        `.trim()}
        {...props}
        role="alert"
      >
        <div
          className={`
            flex items-center justify-center
            w-14 h-14 rounded-full
            bg-[var(--color-danger-muted)] text-[var(--color-danger)]
          `.trim()}
          aria-hidden="true"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
            {title}
          </h3>
          <p className="mt-1 text-[var(--color-foreground-muted)] max-w-sm">
            {message}
          </p>
        </div>
        {action && (
          <Button {...action} className="w-auto">
            {action.children}
          </Button>
        )}
        {onRetry && !action && (
          <Button variant="secondary" onClick={handleRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  },
);

ErrorState.displayName = "ErrorState";
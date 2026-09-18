import { type InputHTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const _excluded = ["ref"];

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leadingIcon,
      trailingIcon,
      fullWidth = false,
      className = "",
      id,
      disabled,
      required,
      ...props
    },
    ref,
  ) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

    const baseStyles = `
      w-full rounded-lg border
      bg-[var(--color-background-card)] text-[var(--color-foreground)]
      placeholder-[var(--color-foreground-subtle)]
      transition-all duration-150 ease-out
      disabled:opacity-50 disabled:cursor-not-allowed
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
    `;

    const stateStyles = error
      ? "border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]"
      : "border-[var(--color-border)] focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-2";

    return (
      <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : ""}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            {label}
            {required && <span className="text-[var(--color-danger)] ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <div
              className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--color-foreground-subtle)]"
              aria-hidden="true"
            >
              {leadingIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedBy}
            aria-required={required}
            className={`
              ${baseStyles}
              ${stateStyles}
              px-3 py-2 text-base
              ${leadingIcon ? "pl-10" : ""}
              ${trailingIcon ? "pr-10" : ""}
              ${className}
            `.trim()}
            {...props}
          />
          {trailingIcon && (
            <div
              className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[var(--color-foreground-subtle)]"
              aria-hidden="true"
            >
              {trailingIcon}
            </div>
          )}
          {error && (
            <div
              className="absolute bottom-full left-0 mb-1 px-2 py-1 text-xs text-[var(--color-danger-foreground)] bg-[var(--color-danger)] rounded-md animate-slide-in-from-top"
              id={errorId}
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="text-xs text-[var(--color-foreground-subtle)]">
            {hint}
          </p>
        )}
        {error && hint && (
          <p id={hintId} className="text-xs text-[var(--color-foreground-subtle)]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
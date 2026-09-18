import { type LabelHTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const _excluded = ["ref"];

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, children, className = "", ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`
          block text-sm font-medium text-[var(--color-foreground)]
          ${className}
        `.trim()}
        {...props}
      >
        {children}
        {required && <span className="text-[var(--color-danger)] ml-0.5" aria-hidden="true">*</span>}
      </label>
    );
  },
);

Label.displayName = "Label";
import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export type DividerOrientation = "horizontal" | "vertical";

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  label?: string;
  dashed?: boolean;
}

const _excluded = ["ref"];

export const Divider = forwardRef<HTMLDivElement, DividerProps>(
  ({ orientation = "horizontal", label, dashed = false, className = "", ...props }, ref) => {
    const isHorizontal = orientation === "horizontal";

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={`
          flex items-center gap-4
          ${isHorizontal ? "w-full" : "h-full flex-col"}
          ${className}
        `.trim()}
        {...props}
      >
        {isHorizontal ? (
          <>
            <div
              className={`
                flex-1 h-px
                ${dashed ? "border-t-[var(--color-border)] border-t-[1px] border-dashed" : "bg-[var(--color-border)]"}
              `.trim()}
            />
            {label && (
              <span
                className="px-3 text-xs font-medium text-[var(--color-foreground-muted)] whitespace-nowrap shrink-0"
                aria-hidden="true"
              >
                {label}
              </span>
            )}
            <div
              className={`
                flex-1 h-px
                ${dashed ? "border-t-[var(--color-border)] border-t-[1px] border-dashed" : "bg-[var(--color-border)]"}
              `.trim()}
            />
          </>
        ) : (
          <>
            <div
              className={`
                flex-1 w-px
                ${dashed ? "border-l-[var(--color-border)] border-l-[1px] border-dashed" : "bg-[var(--color-border)]"}
              `.trim()}
            />
            {label && (
              <span
                className="px-2 py-1 text-xs font-medium text-[var(--color-foreground-muted)] whitespace-nowrap shrink-0 rotate-90"
                aria-hidden="true"
              >
                {label}
              </span>
            )}
            <div
              className={`
                flex-1 w-px
                ${dashed ? "border-l-[var(--color-border)] border-l-[1px] border-dashed" : "bg-[var(--color-border)]"}
              `.trim()}
            />
          </>
        )}
      </div>
    );
  },
);

Divider.displayName = "Divider";
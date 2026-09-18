import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  lines?: number;
  width?: string | number;
  height?: string | number;
}

const _excluded = ["ref"];

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = "text", lines = 1, width, height, className = "", style, ...props }, ref) => {
    const baseStyles = `
      animate-pulse bg-[var(--color-neutral-200)]
      rounded
      overflow-hidden
    `;

    if (variant === "circular") {
      return (
        <div
          ref={ref}
          className={`rounded-full ${className}`.trim()}
          style={{
            width: width || "40px",
            height: height || "40px",
            ...style,
          }}
          {...props}
        />
      );
    }

    if (variant === "rectangular") {
      return (
        <div
          ref={ref}
          className={`rounded-lg ${className}`.trim()}
          style={{
            width: width || "100%",
            height: height || "128px",
            ...style,
          }}
          {...props}
        />
      );
    }

    // text variant with multiple lines
    const skeletonLines = Array.from({ length: lines }, (_, i) => (
      <div
        key={i}
        className="h-4 rounded w-full"
        style={{
          width: i === lines - 1 && width ? "60%" : width,
        }}
      />
    ));

    return (
      <div
        ref={ref}
        className={`space-y-3 ${className}`.trim()}
        style={style}
        {...props}
      >
        {skeletonLines}
      </div>
    );
  },
);

Skeleton.displayName = "Skeleton";

export interface LoadingStateProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  overlay?: boolean;
}

export function LoadingState({ size = "md", text, overlay = false }: LoadingStateProps) {
  const sizeStyles = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const content = (
    <div className="flex flex-col items-center gap-3">
      <svg
        className={`animate-spin text-[var(--color-primary)] ${sizeStyles[size]}`}
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
      {text && <span className="text-sm text-[var(--color-foreground-muted)]">{text}</span>}
    </div>
  );

  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--color-background)/0.8] backdrop-blur-sm"
        role="status"
        aria-live="polite"
        aria-label={text || "Carregando"}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[100px]" role="status" aria-live="polite" aria-label={text || "Carregando"}>
      {content}
    </div>
  );
}
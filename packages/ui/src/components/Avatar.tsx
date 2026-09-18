import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  shape?: "circle" | "square";
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-24 h-24 text-2xl",
};

const shapeStyles = {
  circle: "rounded-full",
  square: "rounded-lg",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
    "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
    "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
    "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]",
    "bg-[var(--color-neutral-200)] text-[var(--color-neutral-700)]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const _excluded = ["ref"];

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, name, size = "md", shape = "circle", className = "", ...props }, ref) => {
    const hasImage = src && src.length > 0;
    const initials = name ? getInitials(name) : "?";
    const bgColor = name ? getColorFromName(name) : "bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)]";

    return (
      <div
        ref={ref}
        className={`
          inline-flex items-center justify-center
          overflow-hidden flex-shrink-0
          ${sizeStyles[size]}
          ${shapeStyles[shape]}
          ${className}
        `.trim()}
        {...props}
      >
        {hasImage ? (
          <img
            src={src}
            alt={alt || name || "Avatar"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`
              flex items-center justify-center w-full h-full font-medium
              ${bgColor}
            `.trim()}
            aria-label={name || "Avatar"}
          >
            {initials}
          </div>
        )}
      </div>
    );
  },
);

Avatar.displayName = "Avatar";
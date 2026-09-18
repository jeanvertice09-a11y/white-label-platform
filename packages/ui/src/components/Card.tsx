import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
}

const variantStyles = {
  default: "bg-[var(--color-background-card)] border border-[var(--color-border)]",
  outlined: "bg-transparent border-2 border-[var(--color-border)]",
  elevated: "bg-[var(--color-background-card)] shadow-lg border-none",
};

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const _excluded = ["ref"];

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", hoverable = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-xl
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hoverable ? "transition-shadow duration-200 hover:shadow-lg cursor-pointer" : ""}
          ${className}
        `.trim()}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", children, ...props }, ref) => (
    <div ref={ref} className={`mb-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  ),
);

CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = "", children, ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-xl font-semibold text-[var(--color-foreground)] ${className}`.trim()}
      {...props}
    >
      {children}
    </h3>
  ),
);

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}
export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = "", children, ...props }, ref) => (
    <p
      ref={ref}
      className={`text-sm text-[var(--color-foreground-muted)] ${className}`.trim()}
      {...props}
    >
      {children}
    </p>
  ),
);

CardDescription.displayName = "CardDescription";

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = "", children, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  ),
);

CardContent.displayName = "CardContent";

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = "", children, ...props }, ref) => (
    <div
      ref={ref}
      className={`mt-4 flex items-center gap-2 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  ),
);

CardFooter.displayName = "CardFooter";
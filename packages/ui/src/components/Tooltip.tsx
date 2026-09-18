import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef, useState, useRef, useEffect } from "react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
  offset?: number;
}

const placementStyles: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowPlacementStyles: Record<TooltipPlacement, string> = {
  top: "bottom-[-4px] left-1/2 -translate-x-1/2 border-t-[var(--color-neutral-800)]",
  bottom: "top-[-4px] left-1/2 -translate-x-1/2 border-b-[var(--color-neutral-800)]",
  left: "right-[-4px] top-1/2 -translate-y-1/2 border-l-[var(--color-neutral-800)]",
  right: "left-[-4px] top-1/2 -translate-y-1/2 border-r-[var(--color-neutral-800)]",
};

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      content,
      children,
      placement = "top",
      delay = 200,
      offset = 8,
      className = "",
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const childRef = useRef<HTMLElement>(null);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    const handleMouseEnter = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsOpen(true), delay);
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsOpen(false);
    };

    const handleFocus = () => setIsOpen(true);
    const handleBlur = () => setIsOpen(false);

    const child = React.Children.only(children);
    const childProps = child.props as React.HTMLAttributes<HTMLElement>;

    return (
      <div
        ref={ref}
        className={`relative inline-flex ${className}`.trim()}
        {...props}
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {React.cloneElement(children as React.ReactElement, {
          ref: childRef,
          onMouseEnter: (e: React.MouseEvent) => {
            childProps.onMouseEnter?.(e);
            handleMouseEnter();
          },
          onMouseLeave: (e: React.MouseEvent) => {
            childProps.onMouseLeave?.(e);
            handleMouseLeave();
          },
          onFocus: (e: React.FocusEvent) => {
            childProps.onFocus?.(e);
            handleFocus();
          },
          onBlur: (e: React.FocusEvent) => {
            childProps.onBlur?.(e);
            handleBlur();
          },
        })}
      {isOpen && (
        <div
          className={`
            fixed z-[var(--z-tooltip)]
            ${placementStyles[placement]}
            animate-fade-in
          `.trim()}
          style={{
            "--tooltip-offset": `${offset}px`,
          }}
          role="tooltip"
          aria-hidden="true"
        >
          <div
            className={`
              px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-0)]
              bg-[var(--color-neutral-900)] rounded-md shadow-lg
              whitespace-nowrap max-w-xs
            `.trim()}
          >
            {content}
          </div>
          <div
            className={`
              absolute w-0 h-0 border-4 border-transparent
              ${arrowPlacementStyles[placement]}
            `.trim()}
            aria-hidden="true"
          />
        </div>
      )}
      </div>
    );
  },
);

Tooltip.displayName = "Tooltip";
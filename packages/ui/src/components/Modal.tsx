import { type HTMLAttributes, type ReactNode, type ForwardRefExoticComponent, type RefAttributes, forwardRef, useEffect, useRef } from "react";
import { Button } from "./Button";
import { type ButtonProps } from "./Button";

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      title,
      description,
      children,
      size = "md",
      showCloseButton = true,
      closeOnOverlayClick = true,
      closeOnEscape = true,
      className = "",
      ...props
    },
    ref,
  ) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
      if (open) {
        previousActiveElement.current = document.activeElement as HTMLElement;
        document.body.style.overflow = "hidden";
        contentRef.current?.focus();
      } else {
        document.body.style.overflow = "";
        previousActiveElement.current?.focus();
      }
      return () => {
        document.body.style.overflow = "";
      };
    }, [open]);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!open) return;
        if (event.key === "Escape" && closeOnEscape) {
          onClose();
        }
        if (event.key === "Tab") {
          const focusableElements = contentRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (!focusableElements || focusableElements.length === 0) return;
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, closeOnEscape]);

    if (!open) return null;

    return (
      <div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? undefined : undefined}
        aria-describedby={description ? undefined : undefined}
      >
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-[var(--color-neutral-900)/0.5] backdrop-blur-sm animate-fade-in"
          onClick={closeOnOverlayClick ? onClose : undefined}
          aria-hidden="true"
        />
        <div
          ref={contentRef}
          tabIndex={-1}
          className={`
            relative w-full ${sizeStyles[size]}
            bg-[var(--color-background-card)]
            rounded-xl shadow-xl
            animate-slide-in-from-bottom
            flex flex-col max-h-[calc(100vh-2rem)]
            ${className}
          `.trim()}
        >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between gap-4 p-6 border-b border-[var(--color-border)]">
              <div>
                {title && (
                  <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
                    {title}
                  </h2>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`
                    p-1.5 rounded-lg
                    text-[var(--color-foreground-muted)]
                    hover:text-[var(--color-foreground)]
                    hover:bg-[var(--color-background-hover)]
                    transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]
                  `.trim()}
                  aria-label="Fechar"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    );
  },
);

Modal.displayName = "Modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-[var(--color-foreground-muted)] mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
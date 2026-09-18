import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef, useMemo } from "react";
import { Button } from "./Button";
import { type ButtonProps } from "./Button";

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemsPerPage?: number;
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  maxVisiblePages?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 10,
  showPageSizeSelector = false,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  showFirstLast = true,
  showPrevNext = true,
  maxVisiblePages = 5,
  className = "",
  ...props
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    const half = Math.floor(maxVisiblePages / 2);

    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("ellipsis");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("ellipsis");
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  return (
    <nav
      className={`flex flex-col sm:flex-row sm-items-center sm-justify-between gap-4 ${className}`.trim()}
      aria-label="Paginação"
      {...props}
    >
      <div className="flex flex-col sm:flex-row sm-items-center gap-3 w-full sm:w-auto">
        <div className="text-sm text-[var(--color-foreground-muted)]">
          Mostrando{" "}
          <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>{" "}
          a{" "}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, totalItems || currentPage * itemsPerPage)}
          </span>{" "}
          de <span className="font-medium">{totalItems || totalPages * itemsPerPage}</span> resultados
        </div>

        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="sr-only">
              Itens por página
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className={`
                px-2 py-1.5 text-sm border border-[var(--color-border)]
                rounded-lg bg-[var(--color-background-card)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]
              `.trim()}
              aria-label="Itens por página"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} por página
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {showFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="Primeira página"
            aria-disabled={currentPage === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 18l-6-6 6-6" />
              <path d="M6 18l6-6-6-6" />
            </svg>
          </Button>
        )}

        {showPrevNext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Página anterior"
            aria-disabled={currentPage === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Button>
        )}

        {pages.map((page, index) => (
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-[var(--color-foreground-muted)]" aria-hidden="true">…</span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "primary" : "ghost"}
              size="sm"
              onClick={() => onPageChange(page)}
              aria-label={`Página ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </Button>
          )
        ))}

        {showPrevNext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Próxima página"
            aria-disabled={currentPage === totalPages}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Button>
        )}

        {showFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Última página"
            aria-disabled={currentPage === totalPages}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l6 6-6 6" />
              <path d="M18 6l-6 6 6 6" />
            </svg>
          </Button>
        )}
      </div>
    </nav>
  );
}
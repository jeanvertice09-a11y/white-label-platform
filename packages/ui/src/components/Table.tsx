import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef, type ReactNode } from "react";
import { type BadgeProps } from "./Badge";
import { Badge } from "./Badge";

export interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface TableProps<T> extends HTMLAttributes<HTMLTableElement> {
  columns: Column<T>[];
  data: T[];
  keyAccessor: (row: T) => string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  hoverable?: boolean;
  loading?: boolean;
  skeletonRows?: number;
}

function TableHeader<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <thead>
      <tr className="border-b border-[var(--color-border)]">
        {columns.map((column) => (
          <th
            key={column.key}
            scope="col"
            className={`
              px-4 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]
              uppercase tracking-wider
              ${column.headerClassName || ""}
            `.trim()}
            style={column.width ? { width: column.width } : undefined}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableBody<T>({
  columns,
  data,
  keyAccessor,
  rowClassName,
  onRowClick,
  striped,
  hoverable,
}: {
  columns: Column<any>[];
  data: any[];
  keyAccessor: (row: any) => string;
  rowClassName?: (row: any) => string;
  onRowClick?: (row: any) => void;
  striped?: boolean;
  hoverable?: boolean;
}) {
  if (data.length === 0) return null;

  return (
    <tbody className="divide-y divide-[var(--color-border)]">
      {data.map((row, rowIndex) => (
        <tr
          key={keyAccessor(row)}
          className={`
            ${striped && rowIndex % 2 === 1 ? "bg-[var(--color-background-muted)]" : ""}
            ${hoverable ? "hover:bg-[var(--color-background-hover)]" : ""}
            ${onRowClick ? "cursor-pointer" : ""}
            transition-colors duration-100
            ${rowClassName ? rowClassName(row) : ""}
          `.trim()}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          {columns.map((column) => (
            <td
              key={column.key}
              className={`
                px-4 py-3 text-sm text-[var(--color-foreground)]
                ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : ""}
                ${column.className || ""}
              `.trim()}
              style={column.width ? { width: column.width } : undefined}
            >
              {column.accessor(row)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function TableEmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <tbody>
      <tr>
        <td colSpan={99} className="py-16 px-4 text-center">
          <div className="flex flex-col items-center gap-4">
            {icon && (
              <div className="w-16 h-16 rounded-full bg-[var(--color-neutral-100)] text-[var(--color-foreground-subtle)] flex items-center justify-center" aria-hidden="true">
                {icon}
              </div>
            )}
            <p className="text-[var(--color-foreground-muted)]">{message}</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

function TableSkeleton({ columns, rows = 5 }: { columns: Column<any>[]; rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {columns.map((column) => (
            <td key={column.key} className="px-4 py-3">
              <div className="h-4 bg-[var(--color-neutral-200)] rounded w-3/4 animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export interface TableProps<T> extends HTMLAttributes<HTMLTableElement> {
  columns: Column<T>[];
  data: T[];
  keyAccessor: (row: T) => string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  hoverable?: boolean;
  loading?: boolean;
  skeletonRows?: number;
}

export function Table<T>({
  columns,
  data,
  keyAccessor,
  emptyMessage = "Nenhum registro encontrado",
  emptyIcon,
  rowClassName,
  onRowClick,
  striped = true,
  hoverable = true,
  loading = false,
  skeletonRows = 5,
  className = "",
  ...props
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-background-card)]">
      <table className="w-full" {...props}>
        <TableHeader columns={columns} />
        {loading ? (
          <TableSkeleton columns={columns} rows={5} />
        ) : data.length === 0 ? (
          <TableEmptyState message={emptyMessage} icon={emptyIcon} />
        ) : (
          <TableBody
            columns={columns}
            data={data}
            keyAccessor={keyAccessor}
            rowClassName={rowClassName}
            onRowClick={onRowClick}
            striped={striped}
            hoverable={hoverable}
          />
        )}
      </table>
    </div>
  );
}
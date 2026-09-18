import { type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes, forwardRef } from "react";
import { Card } from "./Card";

export type MetricTrend = "up" | "down" | "neutral";

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: MetricTrend;
  trendValue?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

function TrendIcon({ trend }: { trend: MetricTrend }) {
  switch (trend) {
    case "up":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-success)]"
          aria-hidden="true"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      );
    case "down":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-danger)]"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    default:
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-neutral-400)]"
          aria-hidden="true"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
  }
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  trendValue,
  icon,
  loading = false,
  className = "",
}: MetricCardProps) {
  return (
    <Card padding="md" className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-foreground-muted)] truncate">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <>
                <span className="text-2xl font-bold text-[var(--color-foreground)]">
                  <span className="animate-pulse">— — —</span>
                </span>
                {trend && trendValue && (
                  <span className="flex items-center gap-1 text-sm">
                    <TrendIcon trend={trend} />
                    <span className="font-medium">{trendValue}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-[var(--color-foreground)]">
                  {value}
                </span>
                {trend && trendValue && (
                  <span className="flex items-center gap-1 text-sm">
                    <TrendIcon trend={trend} />
                    <span className="font-medium">{trendValue}</span>
                  </span>
                )}
              </>
            )}
          </div>
          {description && (
            <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={`
              flex-shrink-0 flex items-center justify-center
              w-12 h-12 rounded-lg
              bg-[var(--color-primary-muted)] text-[var(--color-primary)]
            `.trim()}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
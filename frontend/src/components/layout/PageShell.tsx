import type { ReactNode } from 'react';

export interface PageShellProps {
  /** Omitted by the dashboard, whose panels title themselves. */
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  action,
  children,
}: PageShellProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Dropped entirely when there is nothing to put in it, so the page does
          not carry the header's bottom margin as dead space. */}
      {(title || action) && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            {title && (
              <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </main>
  );
}

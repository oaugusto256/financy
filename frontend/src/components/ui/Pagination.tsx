import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

// Every page number is rendered. Slice 4 revisits this if a user's history
// grows past a page count that fits on the line; building ellipsis logic now
// would be solving a problem no one has.
export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Paginação" className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 bg-white',
          'text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white',
        )}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>

      {pages.map((value) => (
        <button
          key={value}
          type="button"
          aria-current={value === page ? 'page' : undefined}
          onClick={() => onPageChange(value)}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-lg border text-sm font-medium',
            value === page
              ? 'border-brand-base bg-brand-base text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-200',
          )}
        >
          {value}
        </button>
      ))}

      <button
        type="button"
        aria-label="Próxima página"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 bg-white',
          'text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-white',
        )}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}

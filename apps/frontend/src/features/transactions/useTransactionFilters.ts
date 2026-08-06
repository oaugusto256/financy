import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TransactionFilter } from '@/graphql/generated/graphql';
import { ALL_PERIODS, periodRange } from '@/lib/period';

/** frontend.md section 5: typing must not fire a request per keystroke. */
export const SEARCH_DEBOUNCE_MS = 300;

const TYPES = ['INCOME', 'EXPENSE'];

export interface FilterValues {
  search: string;
  type: string;
  categoryId: string;
  period: string;
}

export interface TransactionFiltersState {
  values: FilterValues;
  draftSearch: string;
  setDraftSearch: (value: string) => void;
  setValue: (field: 'type' | 'categoryId' | 'period', value: string) => void;
  clear: () => void;
  isFiltered: boolean;
  filter: TransactionFilter | undefined;
  page: number;
}

/**
 * Short names because they are user-visible in a shared link. `period` holds
 * yyyy-MM rather than two ISO instants: the range is derivable, and a URL
 * carrying two timestamps is not one a person can read or edit.
 */
const PARAM = {
  search: 'q',
  type: 'type',
  categoryId: 'category',
  period: 'period',
} as const;

/**
 * Every filter, and the page, live in the query string — so a filtered view
 * reloads, bookmarks, shares, and survives the back button. frontend.md
 * section 5.
 *
 * Nothing here is mirrored in component state except the search input's draft,
 * which exists only to keep typing responsive between debounce ticks. Mirroring
 * the rest would make the back button change the URL and not the bar.
 */
export function useTransactionFilters(): TransactionFiltersState {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get(PARAM.search) ?? '';
  const rawType = searchParams.get(PARAM.type) ?? '';
  // A hand-typed ?type=TRANSFER would be BAD_USER_INPUT at the API and would
  // surface as the table's error state — an error about the URL, dressed as a
  // failure to load. Unknown values are simply not filters.
  const type = TYPES.includes(rawType) ? rawType : '';
  const categoryId = searchParams.get(PARAM.categoryId) ?? '';
  const period = searchParams.get(PARAM.period) ?? ALL_PERIODS;
  const range = periodRange(period);

  const requested = Number(searchParams.get('page'));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [draftSearch, setDraftSearch] = useState(search);
  // Tracks the last URL-driven `search` this render loop has seen, so a
  // change to it — including a back navigation — is caught during render
  // rather than in an effect: "adjusting state when a prop changes"
  // (https://react.dev/learn/you-might-not-need-an-effect). Doing the same
  // `setDraftSearch` call inside a bare `useEffect` cascades an extra render
  // on every mismatch, which `react-hooks/set-state-in-effect` rejects.
  const [syncedSearch, setSyncedSearch] = useState(search);

  // The URL is the source of truth, so a back navigation (or a clear) has to
  // pull the input back with it. Comparing against `syncedSearch` rather than
  // reacting to every `search` change keeps this from fighting the debounce
  // below: while typing, `search` still holds the old value, and the effect
  // below is what changes it, so this only fires again once it has.
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    setDraftSearch(search);
  }

  useEffect(() => {
    if (draftSearch === search) return;

    const timer = setTimeout(() => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (draftSearch) params.set(PARAM.search, draftSearch);
          else params.delete(PARAM.search);
          // Changing any filter resets to page 1. Deleting the param is that
          // reset: an absent page already means 1.
          params.delete('page');
          return params;
        },
        // Seven keystrokes must not become seven history entries between the
        // user and the page they came from.
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draftSearch, search, setSearchParams]);

  function setValue(field: 'type' | 'categoryId' | 'period', value: string) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (value) params.set(PARAM[field], value);
      else params.delete(PARAM[field]);
      params.delete('page');
      return params;
    });
  }

  function clear() {
    setDraftSearch('');
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      for (const name of Object.values(PARAM)) params.delete(name);
      params.delete('page');
      return params;
    });
  }

  const filter: TransactionFilter | undefined =
    search || type || categoryId || range
      ? {
          ...(search && { search }),
          ...(type && { type: type as TransactionFilter['type'] }),
          ...(categoryId && { categoryId }),
          ...(range && { dateFrom: range.dateFrom, dateTo: range.dateTo }),
        }
      : // Undefined, not {}: an empty object is a different query key from no
        // filter at all, and would split the cache for no reason.
        undefined;

  return {
    values: { search, type, categoryId, period },
    draftSearch,
    setDraftSearch,
    setValue,
    clear,
    isFiltered: filter !== undefined,
    filter,
    page,
  };
}

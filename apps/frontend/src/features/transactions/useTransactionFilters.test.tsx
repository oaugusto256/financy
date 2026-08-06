import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { useTransactionFilters } from './useTransactionFilters';

/**
 * A probe rather than renderHook: this hook's whole job is the URL, and the
 * router is the thing under test with it. Rendering the search string is how
 * every assertion below reads it.
 */
function Probe() {
  const filters = useTransactionFilters();
  const location = useLocation();

  return (
    <div>
      <p data-testid="search">{location.search}</p>
      <p data-testid="filter">{JSON.stringify(filters.filter ?? null)}</p>
      <p data-testid="page">{filters.page}</p>
      <p data-testid="isFiltered">{String(filters.isFiltered)}</p>
      <p data-testid="values-period">{filters.values.period}</p>
      <input
        aria-label="busca"
        value={filters.draftSearch}
        onChange={(event) => filters.setDraftSearch(event.target.value)}
      />
      <button onClick={() => filters.setValue('type', 'INCOME')}>tipo</button>
      <button onClick={() => filters.setValue('type', 'EXPENSE')}>
        tipo despesa
      </button>
      <button onClick={() => filters.setValue('period', '2026-08')}>
        período
      </button>
      <button onClick={filters.clear}>limpar</button>
    </div>
  );
}

/**
 * `createMemoryRouter` + `RouterProvider` rather than a plain `MemoryRouter`:
 * the last test drives a real back navigation, and `window.history` does not
 * reach a `MemoryRouter`'s own in-memory history stack — only the router
 * object's own `navigate` does. Using the data router everywhere keeps every
 * test in this file on one rendering path instead of switching setups only
 * for the last case.
 */
function renderProbe(route = '/transactions') {
  const router = createMemoryRouter(
    [{ path: '/transactions', element: <Probe /> }],
    { initialEntries: [route] },
  );

  return { ...render(<RouterProvider router={router} />), router };
}

describe('useTransactionFilters', () => {
  it('sends no filter at all when nothing is set', () => {
    // The default has to be a plain undefined, not an object of empty
    // strings: an empty object still changes the query key and would split
    // the cache from every other unfiltered caller.
    renderProbe();

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
    expect(screen.getByTestId('isFiltered')).toHaveTextContent('false');
    expect(screen.getByTestId('page')).toHaveTextContent('1');
  });

  it('reads every filter out of the URL', () => {
    renderProbe(
      '/transactions?q=mercado&type=EXPENSE&category=cat-1&period=2026-08&page=3',
    );

    expect(JSON.parse(screen.getByTestId('filter').textContent ?? '')).toEqual({
      search: 'mercado',
      type: 'EXPENSE',
      categoryId: 'cat-1',
      dateFrom: '2026-08-01T03:00:00.000Z',
      dateTo: '2026-09-01T02:59:59.999Z',
    });
    expect(screen.getByTestId('page')).toHaveTextContent('3');
    expect(screen.getByTestId('isFiltered')).toHaveTextContent('true');
  });

  it('writes a select straight to the URL', async () => {
    renderProbe();

    await userEvent.click(screen.getByRole('button', { name: 'tipo' }));

    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');
  });

  it('debounces the search rather than writing per keystroke', async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.type(screen.getByLabelText('busca'), 'luz');

    // The input shows it immediately; the URL has not caught up.
    expect(screen.getByLabelText('busca')).toHaveValue('luz');
    expect(screen.getByTestId('search')).not.toHaveTextContent('q=');

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('q=luz'),
    );
  });

  it('drops the page when a filter changes', async () => {
    // frontend.md section 5: changing any filter resets to page 1. Deleting
    // the param is the reset — an absent page already means 1, and unlike
    // page=1 it cannot collide with the page clamp effect on the page
    // component, which only ever fires on loaded data.
    renderProbe('/transactions?page=3');

    await userEvent.click(screen.getByRole('button', { name: 'tipo' }));

    expect(screen.getByTestId('page')).toHaveTextContent('1');
    expect(screen.getByTestId('search')).not.toHaveTextContent('page=');
  });

  it('drops the page when the debounced search lands', async () => {
    const user = userEvent.setup();
    renderProbe('/transactions?page=3');

    await user.type(screen.getByLabelText('busca'), 'luz');

    await waitFor(() =>
      expect(screen.getByTestId('page')).toHaveTextContent('1'),
    );
  });

  it('keeps a filter when another one changes', async () => {
    renderProbe('/transactions?q=mercado');

    await userEvent.click(screen.getByRole('button', { name: 'tipo' }));

    const search = screen.getByTestId('search');
    expect(search).toHaveTextContent('q=mercado');
    expect(search).toHaveTextContent('type=INCOME');
  });

  it('clears everything at once', async () => {
    renderProbe('/transactions?q=mercado&type=EXPENSE&period=2026-08&page=2');

    await userEvent.click(screen.getByRole('button', { name: 'limpar' }));

    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(screen.getByTestId('filter')).toHaveTextContent('null');
    expect(screen.getByLabelText('busca')).toHaveValue('');
  });

  it('ignores a period that is not a month', async () => {
    // ?period=banana is typeable. It must not reach the API as a range.
    renderProbe('/transactions?period=banana');

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
    // `values.period` has to fall back to ALL_PERIODS too, not just `filter`:
    // it feeds a native <select> directly, and "banana" matches no <option>,
    // which would desync the visible control from the "all periods" state
    // the URL actually produces.
    expect(screen.getByTestId('values-period')).toHaveTextContent('');
  });

  it('ignores an unpadded period that date-fns would still parse', async () => {
    // date-fns' `parse` is lenient about padding — '2026-8' parses to a
    // valid August 2026 — but `periodOptions()` only ever emits the
    // zero-padded form, so this value would still match no <option>.
    renderProbe('/transactions?period=2026-8');

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
    expect(screen.getByTestId('values-period')).toHaveTextContent('');
  });

  it('ignores a type outside the enum', () => {
    // Likewise ?type=TRANSFER — the API would answer BAD_USER_INPUT and the
    // table would show an error state for a URL, not for a real failure.
    renderProbe('/transactions?type=TRANSFER');

    expect(screen.getByTestId('filter')).toHaveTextContent('null');
  });

  it('follows the URL when the user navigates back', async () => {
    // The reason the state lives here at all. If the hook cached the values in
    // useState, going back would change the URL and leave the bar untouched.
    //
    // `router.navigate(-1)` rather than `history.back()`: this probe is
    // rendered through a data router (`createMemoryRouter`), whose history is
    // its own in-memory stack, not `window.history` — the global object
    // does not drive it, so a real back navigation has to go through the
    // router object itself. `navigate(-1)` is that data router's equivalent
    // of the browser back button.
    //
    // Asserting only the location's search string would not have teeth: react-
    // router reverts that on its own regardless of what this hook does
    // internally, so a hook that cached `type` in its own useState instead of
    // reading it fresh every render would still pass a test that only reads
    // `location.search`. `type` is therefore toggled between two different
    // values here, and `filter` — the hook's own derived output — is asserted
    // too, so a regression of exactly that kind actually fails the test. (Proven
    // by temporarily mirroring `type` in useState: this test failed, see the
    // task report.)
    const user = userEvent.setup();
    const { router } = renderProbe();

    await user.click(screen.getByRole('button', { name: 'tipo' }));
    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');

    await user.click(screen.getByRole('button', { name: 'período' }));
    expect(screen.getByTestId('search')).toHaveTextContent('period=2026-08');

    await user.click(screen.getByRole('button', { name: 'tipo despesa' }));
    expect(screen.getByTestId('search')).toHaveTextContent('type=EXPENSE');
    expect(screen.getByTestId('filter')).toHaveTextContent('"type":"EXPENSE"');

    await act(() => router.navigate(-1));

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME'),
    );
    expect(screen.getByTestId('search')).not.toHaveTextContent('type=EXPENSE');
    expect(screen.getByTestId('search')).toHaveTextContent('period=2026-08');
    expect(screen.getByTestId('filter')).toHaveTextContent('"type":"INCOME"');
    expect(screen.getByTestId('filter')).not.toHaveTextContent(
      '"type":"EXPENSE"',
    );
  });

  it('replaces the debounced search rather than growing history', async () => {
    // "Seven keystrokes must not become seven history entries between the
    // user and the page they came from" — the reason the debounced write
    // uses `{ replace: true }`. A single step back cannot tell a replace from
    // a push apart: both a replaced and a pushed `q=luz` entry land on the
    // same content after one step back from a later `tipo` push. The
    // difference only shows on a *second* step back — a pushed write leaves a
    // genuinely empty entry underneath to land on; a replaced write does not,
    // because it never created a separate entry in the first place.
    const user = userEvent.setup();
    const { router } = renderProbe();

    await user.type(screen.getByLabelText('busca'), 'luz');
    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('q=luz'),
    );

    await user.click(screen.getByRole('button', { name: 'tipo' }));
    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');
    expect(screen.getByTestId('search')).toHaveTextContent('q=luz');

    await act(() => router.navigate(-1));
    await waitFor(() =>
      expect(screen.getByTestId('search')).not.toHaveTextContent('type='),
    );
    expect(screen.getByTestId('search')).toHaveTextContent('q=luz');

    await act(() => router.navigate(-1));
    // No earlier entry exists to land on: the debounced write replaced the
    // starting location instead of pushing beside it.
    expect(screen.getByTestId('search')).toHaveTextContent('q=luz');
  });

  it('pulls the search box back with the URL, not just on clear', async () => {
    // The render-phase sync exists so a back navigation restores the input —
    // not only `clear()`, which resets it directly and would pass even with
    // the sync deleted. Two different search values have to land on two
    // different history entries for a back step to actually change `search`;
    // since the debounced write always replaces the *current* entry, that
    // only happens by writing the second value after an unrelated push
    // (`tipo`) has moved the current entry forward.
    const user = userEvent.setup();
    const { router } = renderProbe();

    await user.type(screen.getByLabelText('busca'), 'mercado');
    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('q=mercado'),
    );

    await user.click(screen.getByRole('button', { name: 'tipo' }));
    expect(screen.getByTestId('search')).toHaveTextContent('type=INCOME');
    expect(screen.getByTestId('search')).toHaveTextContent('q=mercado');

    await user.clear(screen.getByLabelText('busca'));
    await user.type(screen.getByLabelText('busca'), 'luz');
    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('q=luz'),
    );
    expect(screen.getByLabelText('busca')).toHaveValue('luz');

    await act(() => router.navigate(-1));

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('q=mercado'),
    );
    expect(screen.getByTestId('search')).not.toHaveTextContent('q=luz');
    expect(screen.getByLabelText('busca')).toHaveValue('mercado');
  });
});

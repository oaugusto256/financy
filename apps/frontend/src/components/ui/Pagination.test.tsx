import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('marks the current page', () => {
    render(<Pagination page={2} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('reports the page that was chosen', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on the first page', () => {
    render(<Pagination page={1} pageCount={3} onPageChange={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeDisabled();
  });

  it('disables next on the last page', () => {
    render(<Pagination page={3} pageCount={3} onPageChange={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Próxima página' }),
    ).toBeDisabled();
  });

  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TopBar } from './TopBar';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar userName="Conta teste" />
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  it('links to every section', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(screen.getByRole('link', { name: 'Categorias' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('marks the active section for assistive tech', () => {
    renderAt('/transactions');
    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('links the avatar to the profile', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute(
      'href',
      '/profile',
    );
  });
});

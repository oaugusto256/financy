import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { useToast } from '@/components/ui/useToast';

function Harness() {
  const { showToast } = useToast();

  return (
    <>
      <button onClick={() => showToast('Categoria criada')}>Sucesso</button>
      <button onClick={() => showToast('Não foi possível salvar', 'error')}>
        Falha
      </button>
    </>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

describe('Toast', () => {
  it('shows a success message', async () => {
    renderHarness();

    await userEvent.click(screen.getByRole('button', { name: 'Sucesso' }));

    expect(await screen.findByText('Categoria criada')).toBeInTheDocument();
  });

  it('announces the message to assistive technology', async () => {
    renderHarness();

    await userEvent.click(screen.getByRole('button', { name: 'Sucesso' }));

    // A confirmation nobody hears is not feedback. frontend.md section 10.
    // Radix's live-region announcer exists (empty) almost immediately, then
    // fills in its text after a double requestAnimationFrame — waitFor
    // retries the whole assertion against that mutation, not just presence.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Categoria criada'),
    );
  });

  it('shows more than one at a time rather than replacing', async () => {
    renderHarness();

    await userEvent.click(screen.getByRole('button', { name: 'Sucesso' }));
    await userEvent.click(screen.getByRole('button', { name: 'Falha' }));

    expect(await screen.findByText('Categoria criada')).toBeInTheDocument();
    expect(
      await screen.findByText('Não foi possível salvar'),
    ).toBeInTheDocument();
  });

  it('dismisses one when its close button is used', async () => {
    renderHarness();
    await userEvent.click(screen.getByRole('button', { name: 'Sucesso' }));
    await screen.findByText('Categoria criada');

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));

    expect(screen.queryByText('Categoria criada')).not.toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    // A toast that silently does nothing is worse than a crash in development:
    // the mutation looks like it gave feedback and did not.
    expect(() => render(<Harness />)).toThrow(
      'useToast must be used inside a ToastProvider',
    );
  });
});

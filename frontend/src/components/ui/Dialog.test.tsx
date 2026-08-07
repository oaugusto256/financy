import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={vi.fn()} title="Nova transação">
        <p>Conteúdo</p>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the title, subtitle and content when open', () => {
    render(
      <Dialog
        open
        onClose={vi.fn()}
        title="Nova transação"
        subtitle="Registre sua despesa ou receita"
      >
        <p>Conteúdo</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Nova transação');
    expect(
      screen.getByText('Registre sua despesa ou receita'),
    ).toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('closes on the close button', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Nova transação">
        <p>Conteúdo</p>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Nova transação">
        <p>Conteúdo</p>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

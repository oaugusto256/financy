import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is findable by its accessible name', () => {
    render(<IconButton icon={Trash2} label="Excluir transação" />);
    expect(
      screen.getByRole('button', { name: 'Excluir transação' }),
    ).toBeInTheDocument();
  });

  it('calls the handler when clicked', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Trash2} label="Excluir" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call the handler when disabled', async () => {
    const onClick = vi.fn();
    render(
      <IconButton icon={Trash2} label="Excluir" onClick={onClick} disabled />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

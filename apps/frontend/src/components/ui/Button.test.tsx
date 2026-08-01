import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { Button } from './Button';

describe('Button', () => {
  it('calls the handler when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call the handler when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables itself while loading', () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('renders a leading icon hidden from screen readers', () => {
    const { container } = render(<Button icon={Plus}>Nova transação</Button>);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('defaults to type button', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mail } from 'lucide-react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the field', async () => {
    render(<Input label="E-mail" />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com');
    expect(screen.getByLabelText('E-mail')).toHaveValue('a@b.com');
  });

  it('renders helper text when there is no error', () => {
    render(<Input label="Senha" helperText="Mínimo 8 caracteres" />);
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('replaces helper text with the error message', () => {
    render(
      <Input
        label="Senha"
        helperText="Mínimo 8 caracteres"
        error="Muito curta"
      />,
    );
    expect(screen.getByText('Muito curta')).toBeInTheDocument();
    expect(screen.queryByText('Mínimo 8 caracteres')).not.toBeInTheDocument();
  });

  it('marks the field invalid and points to the message for assistive tech', () => {
    render(<Input label="Senha" error="Muito curta" />);
    const field = screen.getByLabelText('Senha');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Muito curta');
  });

  it('can be disabled', () => {
    render(<Input label="E-mail" disabled />);
    expect(screen.getByLabelText('E-mail')).toBeDisabled();
  });

  it('renders a leading icon without exposing it to screen readers', () => {
    const { container } = render(<Input label="E-mail" icon={Mail} />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});

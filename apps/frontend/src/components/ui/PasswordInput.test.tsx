import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('hides the value by default', () => {
    render(<PasswordInput label="Senha" />);
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('reveals and hides the value when the toggle is used', async () => {
    render(<PasswordInput label="Senha" />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar senha' }),
    );
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');

    await userEvent.click(
      screen.getByRole('button', { name: 'Ocultar senha' }),
    );
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });
});

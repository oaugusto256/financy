import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('associates the label with the control', () => {
    render(<Checkbox label="Lembrar-me" />);
    expect(
      screen.getByRole('checkbox', { name: 'Lembrar-me' }),
    ).toBeInTheDocument();
  });

  it('starts unchecked and toggles on click', async () => {
    render(<Checkbox label="Lembrar-me" />);
    const box = screen.getByRole('checkbox', { name: 'Lembrar-me' });

    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
  });

  it('toggles from the keyboard', async () => {
    render(<Checkbox label="Lembrar-me" />);
    const box = screen.getByRole('checkbox', { name: 'Lembrar-me' });

    box.focus();
    await userEvent.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('honours defaultChecked', () => {
    render(<Checkbox label="Lembrar-me" defaultChecked />);
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeChecked();
  });

  it('can be disabled', () => {
    render(<Checkbox label="Lembrar-me" disabled />);
    expect(screen.getByRole('checkbox', { name: 'Lembrar-me' })).toBeDisabled();
  });
});

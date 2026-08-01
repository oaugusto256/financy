import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const options = [
  { value: 'INCOME', label: 'Entrada' },
  { value: 'EXPENSE', label: 'Saída' },
];

describe('Select', () => {
  it('associates the label with the control', () => {
    render(<Select label="Tipo" options={options} />);
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
  });

  it('renders every option', () => {
    render(<Select label="Tipo" options={options} />);
    expect(screen.getByRole('option', { name: 'Entrada' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Saída' })).toBeInTheDocument();
  });

  it('renders a placeholder as a disabled first option', () => {
    render(<Select label="Tipo" options={options} placeholder="Selecione" />);
    expect(screen.getByRole('option', { name: 'Selecione' })).toBeDisabled();
  });

  it('reports the chosen value', async () => {
    render(<Select label="Tipo" options={options} defaultValue="INCOME" />);
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'EXPENSE');
    expect(screen.getByLabelText('Tipo')).toHaveValue('EXPENSE');
  });

  it('shows the error message', () => {
    render(<Select label="Tipo" options={options} error="Obrigatório" />);
    expect(screen.getByLabelText('Tipo')).toHaveAccessibleDescription(
      'Obrigatório',
    );
  });
});

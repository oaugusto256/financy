import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const OPTIONS = [
  { value: 'EXPENSE', label: 'Despesa', tone: 'danger' },
  { value: 'INCOME', label: 'Receita', tone: 'success' },
] as const;

describe('SegmentedControl', () => {
  it('renders one radio per option, named by its label', () => {
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="EXPENSE"
        options={[...OPTIONS]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Receita' })).toBeInTheDocument();
  });

  it('marks the current value as checked', () => {
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="INCOME"
        options={[...OPTIONS]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Receita' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Despesa' })).not.toBeChecked();
  });

  it('reports the new value when another option is chosen', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="EXPENSE"
        options={[...OPTIONS]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Receita' }));

    // The value, not the event. A primitive that hands back a change event
    // makes every consumer reach into event.target.
    expect(onChange).toHaveBeenCalledWith('INCOME');
  });

  it('groups the options under the legend', () => {
    render(
      <SegmentedControl
        legend="Tipo"
        name="type"
        value="EXPENSE"
        options={[...OPTIONS]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Tipo' })).toBeInTheDocument();
  });
});

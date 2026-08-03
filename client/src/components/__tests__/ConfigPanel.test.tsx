import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ConfigPanel from '../admin/ConfigPanel';
import type { AdminConfigDTO, DatePropagationResult } from '../../api/admin-api';

// --- Mocks ---

const updateConfigState = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isSuccess: false,
  error: null as Error | null,
  data: null as null | {
    config: AdminConfigDTO;
    updatedDates: DatePropagationResult[];
    blockedDates: DatePropagationResult[];
  },
  variables: null as null | { key: string; value: number | boolean },
}));

vi.mock('../../hooks/use-admin', () => ({
  useAdminConfig: vi.fn(() => ({
    data: { commission: 10, allowRegistration: true, defaultBetAmount: 1500 },
    isLoading: false,
    error: null,
  })),
  useUpdateConfig: () => ({
    mutate: updateConfigState.mutate,
    isPending: updateConfigState.isPending,
    isSuccess: updateConfigState.isSuccess,
    error: updateConfigState.error,
    data: updateConfigState.data,
    variables: updateConfigState.variables,
  }),
}));

import { useAdminConfig } from '../../hooks/use-admin';

const baseConfig = { commission: 10, allowRegistration: true, defaultBetAmount: 1500 };

function mockConfig(cfg: Partial<typeof baseConfig>) {
  vi.mocked(useAdminConfig).mockReturnValue({
    data: { ...baseConfig, ...cfg },
    isLoading: false,
    error: null,
  } as any);
}

afterEach(() => {
  cleanup();
  updateConfigState.mutate.mockClear();
  updateConfigState.isPending = false;
  updateConfigState.isSuccess = false;
  updateConfigState.error = null;
  updateConfigState.data = null;
  updateConfigState.variables = null;
  vi.mocked(useAdminConfig).mockReset();
  vi.mocked(useAdminConfig).mockReturnValue({
    data: baseConfig,
    isLoading: false,
    error: null,
  } as any);
});

// --- Tests ---

describe('ConfigPanel — default bet amount in pesos', () => {
  it('displays the default bet amount in pesos (cents ÷ 100)', () => {
    mockConfig({ defaultBetAmount: 1500 });

    render(<ConfigPanel />);
    // 1500 cents → $15.00 → the field shows "15"
    expect(screen.getByDisplayValue('15')).toBeDefined();
    // No change yet → the save button stays disabled
    expect(
      (screen.getByRole('button', { name: /Guardar Configuración/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows fractional pesos for non-round cent amounts', () => {
    mockConfig({ defaultBetAmount: 1525 });

    render(<ConfigPanel />);
    // 1525 cents → $15.25
    expect(screen.getByDisplayValue('15.25')).toBeDefined();
  });

  it('sends pesos ×100 as integer cents on save', () => {
    render(<ConfigPanel />);
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Configuración/ }));

    // "5" pesos → 500 cents sent to the API (NOT raw 5)
    expect(updateConfigState.mutate).toHaveBeenCalledWith({
      key: 'defaultBetAmount',
      value: 500,
    });
  });

  it('rounds fractional pesos to integer cents on save', () => {
    render(<ConfigPanel />);
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '5.55' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Configuración/ }));

    // $5.55 → 555 cents (floating point would otherwise drop a cent)
    expect(updateConfigState.mutate).toHaveBeenCalledWith({
      key: 'defaultBetAmount',
      value: 555,
    });
  });

  it('does not save a bet amount below the $1 minimum', () => {
    render(<ConfigPanel />);
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Configuración/ }));

    // Nothing else changed, and $0.50 is below the $1 floor → nothing sent
    expect(updateConfigState.mutate).not.toHaveBeenCalled();
  });

  it('does not mark the form dirty when the pesos value equals the stored cents', () => {
    render(<ConfigPanel />);
    // Field shows "15" for 1500 cents → typing it back must NOT enable save
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '15.00' } });

    expect(
      (screen.getByRole('button', { name: /Guardar Configuración/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(updateConfigState.mutate).not.toHaveBeenCalled();
  });
});

// --- Propagation results (defaultBetAmount saves) ---

describe('ConfigPanel — propagation results for defaultBetAmount', () => {
  function saveDefaultBetAmount() {
    const view = render(<ConfigPanel />);
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Configuración/ }));
    return view;
  }

  it('shows the green default line plus one green line per updated date', () => {
    const view = saveDefaultBetAmount();
    updateConfigState.isSuccess = true;
    updateConfigState.variables = { key: 'defaultBetAmount', value: 500 };
    updateConfigState.data = {
      config: { commission: 10, allowRegistration: true, defaultBetAmount: 500 },
      updatedDates: [
        { id: 46, dateNumber: 46, betAmount: 500 },
        { id: 47, dateNumber: 47, betAmount: 500 },
      ],
      blockedDates: [],
    };
    view.rerender(<ConfigPanel />);

    expect(
      screen.getByText('Éxito: se guardó el nuevo monto de apuesta ($5,00) para futuras fechas.'),
    ).toBeDefined();
    expect(
      screen.getByText('Éxito: se modificó correctamente el monto de la apuesta en la fecha 46.'),
    ).toBeDefined();
    expect(
      screen.getByText('Éxito: se modificó correctamente el monto de la apuesta en la fecha 47.'),
    ).toBeDefined();
    // No red group when nothing is blocked
    expect(screen.queryByText(/no se pudo cambiar el monto/)).toBeNull();
  });

  it('shows a red line per blocked date with the exact blocked-date copy', () => {
    const view = saveDefaultBetAmount();
    updateConfigState.isSuccess = true;
    updateConfigState.variables = { key: 'defaultBetAmount', value: 500 };
    updateConfigState.data = {
      config: { commission: 10, allowRegistration: true, defaultBetAmount: 500 },
      updatedDates: [{ id: 46, dateNumber: 46, betAmount: 500 }],
      blockedDates: [{ id: 45, dateNumber: 45, betAmount: 1500 }],
    };
    view.rerender(<ConfigPanel />);

    expect(
      screen.getByText(
        'Error: no se pudo cambiar el monto de la apuesta en la fecha 45 porque ya existen jugadas para esa fecha.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('Éxito: se modificó correctamente el monto de la apuesta en la fecha 46.'),
    ).toBeDefined();
  });

  it('still shows the green default line when every date is blocked', () => {
    const view = saveDefaultBetAmount();
    updateConfigState.isSuccess = true;
    updateConfigState.variables = { key: 'defaultBetAmount', value: 500 };
    updateConfigState.data = {
      config: { commission: 10, allowRegistration: true, defaultBetAmount: 500 },
      updatedDates: [],
      blockedDates: [
        { id: 45, dateNumber: 45, betAmount: 1500 },
        { id: 44, dateNumber: 44, betAmount: 1500 },
      ],
    };
    view.rerender(<ConfigPanel />);

    // The config persisted — the default line MUST appear regardless
    expect(
      screen.getByText('Éxito: se guardó el nuevo monto de apuesta ($5,00) para futuras fechas.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Error: no se pudo cambiar el monto de la apuesta en la fecha 45 porque ya existen jugadas para esa fecha.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Error: no se pudo cambiar el monto de la apuesta en la fecha 44 porque ya existen jugadas para esa fecha.',
      ),
    ).toBeDefined();
  });

  it('does not render propagation boxes for a non-defaultBetAmount save', () => {
    const view = render(<ConfigPanel />);
    updateConfigState.isSuccess = true;
    updateConfigState.variables = { key: 'commission', value: 12 };
    updateConfigState.data = {
      config: { commission: 12, allowRegistration: true, defaultBetAmount: 1500 },
      updatedDates: [],
      blockedDates: [],
    };
    view.rerender(<ConfigPanel />);

    expect(screen.queryByText(/se guardó el nuevo monto de apuesta/)).toBeNull();
    expect(screen.queryByText(/no se pudo cambiar el monto/)).toBeNull();
  });
});

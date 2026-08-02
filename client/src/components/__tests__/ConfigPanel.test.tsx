import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ConfigPanel from '../admin/ConfigPanel';

// --- Mocks ---

const updateConfigMutate = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/use-admin', () => ({
  useAdminConfig: vi.fn(() => ({
    data: { commission: 10, allowRegistration: true, defaultBetAmount: 1500 },
    isLoading: false,
    error: null,
  })),
  useUpdateConfig: () => ({
    mutate: updateConfigMutate,
    isPending: false,
    isSuccess: false,
    error: null,
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
  updateConfigMutate.mockClear();
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
    expect(updateConfigMutate).toHaveBeenCalledWith({
      key: 'defaultBetAmount',
      value: 500,
    });
  });

  it('rounds fractional pesos to integer cents on save', () => {
    render(<ConfigPanel />);
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '5.55' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Configuración/ }));

    // $5.55 → 555 cents (floating point would otherwise drop a cent)
    expect(updateConfigMutate).toHaveBeenCalledWith({
      key: 'defaultBetAmount',
      value: 555,
    });
  });

  it('does not save a bet amount below the $1 minimum', () => {
    render(<ConfigPanel />);
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Configuración/ }));

    // Nothing else changed, and $0.50 is below the $1 floor → nothing sent
    expect(updateConfigMutate).not.toHaveBeenCalled();
  });

  it('does not mark the form dirty when the pesos value equals the stored cents', () => {
    render(<ConfigPanel />);
    // Field shows "15" for 1500 cents → typing it back must NOT enable save
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '15.00' } });

    expect(
      (screen.getByRole('button', { name: /Guardar Configuración/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(updateConfigMutate).not.toHaveBeenCalled();
  });
});

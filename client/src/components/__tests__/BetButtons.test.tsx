import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BetButtons from '../matches/BetButtons';

// Mock the bet slip store
const setPrediction = vi.fn();
vi.mock('../../stores/bet-slip-store', () => ({
  useBetSlipStore: vi.fn((selector: any) => {
    const state = {
      predictions: {},
      setPrediction,
      removePrediction: vi.fn(),
      reset: vi.fn(),
      getPredictions: () => ({}),
      count: () => 0,
    };
    return selector(state);
  }),
}));

afterEach(() => cleanup());

describe('BetButtons', () => {
  beforeEach(() => {
    setPrediction.mockClear();
  });

  it('renders L, E, V buttons', () => {
    render(
      <BetButtons matchId="1" disabled={false} currentPrediction={null} />,
    );
    expect(screen.getByText('L')).toBeDefined();
    expect(screen.getByText('E')).toBeDefined();
    expect(screen.getByText('V')).toBeDefined();
  });

  it('clicking a button calls setPrediction', async () => {
    const user = userEvent.setup();
    render(
      <BetButtons matchId="1" disabled={false} currentPrediction={null} />,
    );
    await user.click(screen.getByText('L'));
    expect(setPrediction).toHaveBeenCalledWith('1', 'L');
  });

  it('buttons are disabled when disabled prop is true', () => {
    render(
      <BetButtons matchId="1" disabled={true} currentPrediction={null} />,
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

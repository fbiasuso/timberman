import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MatchCard from '../matches/MatchCard';
import type { MatchDTO } from '../../types';

// Mock BetButtons child component to simplify testing
vi.mock('../matches/BetButtons', () => ({
  default: ({ matchId, disabled }: { matchId: string; disabled: boolean }) => (
    <div data-testid="bet-buttons" data-matchid={matchId} data-disabled={disabled}>
      BetButtons
    </div>
  ),
}));

// Mock the bet slip store
vi.mock('../../stores/bet-slip-store', () => ({
  useBetSlipStore: vi.fn((selector: any) => {
    const state = { predictions: {} };
    return selector(state);
  }),
}));

afterEach(() => cleanup());

const baseMatch: MatchDTO = {
  id: 1,
  matchDateId: 10,
  localTeam: 'River Plate',
  visitorTeam: 'Boca Juniors',
  localImg: null,
  visitorImg: null,
  scheduledAt: null,
  result: null,
  score: null,
};

describe('MatchCard', () => {
  it('renders with team names', () => {
    render(<MatchCard match={baseMatch} isExpired={false} />);
    expect(screen.getByText('River Plate')).toBeDefined();
    expect(screen.getByText('Boca Juniors')).toBeDefined();
    expect(screen.getByText('VS')).toBeDefined();
  });

  it('shows expired badge when isExpired is true', () => {
    render(<MatchCard match={baseMatch} isExpired={true} />);
    // Badge includes emoji + text: "🔒 Cerrado"
    expect(screen.getByText(/Cerrado/)).toBeDefined();
  });

  it('hides expired badge when isExpired is false', () => {
    render(<MatchCard match={baseMatch} isExpired={false} />);
    expect(screen.queryByText(/Cerrado/)).toBeNull();
  });

  it('passes disabled to BetButtons when expired', () => {
    render(<MatchCard match={baseMatch} isExpired={true} />);
    const betButtons = screen.getAllByTestId('bet-buttons');
    expect(betButtons.length).toBeGreaterThan(0);
    expect(betButtons[betButtons.length - 1].getAttribute('data-disabled')).toBe('true');
  });
});

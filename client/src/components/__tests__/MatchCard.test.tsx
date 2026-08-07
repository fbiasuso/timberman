import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MatchCard from '../matches/MatchCard';
import type { MatchDTO } from '../../types';

// Deterministically control the mobile/desktop branch for both layouts
const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

vi.mock('../../hooks/use-is-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// Mock BetButtons child component to simplify testing
vi.mock('../matches/BetButtons', () => ({
  default: ({
    matchId,
    disabled,
    layout,
  }: {
    matchId: string;
    disabled: boolean;
    layout?: string;
  }) => (
    <div data-testid="bet-buttons" data-matchid={matchId} data-disabled={disabled} data-layout={layout}>
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

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
});

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

  it('disables BetButtons with lockBetting without the expired badge', () => {
    render(<MatchCard match={baseMatch} isExpired={false} lockBetting={true} />);
    // No closed badge on the card itself
    expect(screen.queryByText(/Cerrado/)).toBeNull();
    // But the bet buttons are disabled (user already bet this date)
    const betButtons = screen.getAllByTestId('bet-buttons');
    expect(betButtons[betButtons.length - 1].getAttribute('data-disabled')).toBe('true');
  });

  it('renders the desktop row layout by default', () => {
    render(<MatchCard match={baseMatch} isExpired={false} />);
    const card = screen.getByTestId('match-card');
    expect(card.style.flexDirection).toBe('row');
    // No stacked grid wrapper on desktop
    expect(screen.queryByTestId('teams-grid')).toBeNull();
    expect(screen.getByTestId('bet-buttons').getAttribute('data-layout')).toBe('row');
  });

  it('stacks teams and bet buttons on mobile with a grid layout', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<MatchCard match={baseMatch} isExpired={false} />);
    const card = screen.getByTestId('match-card');
    expect(card.style.flexDirection).toBe('column');

    // Teams in a 3-column grid: local | center | visitor
    const teamsGrid = screen.getByTestId('teams-grid');
    expect(teamsGrid.style.display).toBe('grid');
    expect(teamsGrid.style.gridTemplateColumns).toBe('1fr 60px 1fr');

    // Buttons use the matching grid layout so L/E/V center under their column
    expect(screen.getByTestId('bet-buttons').getAttribute('data-layout')).toBe('grid');
  });
});

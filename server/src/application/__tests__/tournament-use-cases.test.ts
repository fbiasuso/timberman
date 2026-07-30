import { describe, it, expect, vi } from 'vitest';
import { CreateDateUseCase } from '../tournament/create-date-use-case.js';
import { CloseDateUseCase } from '../tournament/close-date-use-case.js';
import { PublishResultsUseCase } from '../tournament/publish-results-use-case.js';
import { PointsCalculator } from '../tournament/points-calculator.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import { Tournament } from '../../domain/entities/tournament.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { Match } from '../../domain/entities/match.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import { PozoCalculator } from '../betting/pozo-calculator.js';
import {
  TournamentNotFoundError,
  MatchDateNotFoundError,
} from '../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

function createTournamentRepoMocks() {
  const repo: TournamentRepo = {
    findById: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn((md: MatchDate) => Promise.resolve(md)),
    updateMatchDate: vi.fn((md: MatchDate) => Promise.resolve(md)),
  };
  return repo;
}

function createMatchRepoMocks() {
  const repo: MatchRepo = {
    findById: vi.fn(),
    findByMatchDateId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    saveMany: vi.fn(),
  };
  return repo;
}

function createTicketRepoMocks() {
  const repo: TicketRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByMatchDateId: vi.fn(),
    findByUserAndDate: vi.fn(),
    save: vi.fn(),
    countByMatchDateId: vi.fn(),
  };
  return repo;
}

// ── CreateDateUseCase ──────────────────────────────────────────────

describe('CreateDateUseCase', () => {
  it('creates a match date with default bet amount', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });
    vi.mocked(tournamentRepo.findById).mockResolvedValue(tournament);
    vi.mocked(tournamentRepo.saveMatchDate).mockImplementation(async (md) => md);

    const uc = new CreateDateUseCase(tournamentRepo);
    const result = await uc.execute({ tournamentId: 1, dateNumber: 1 });

    expect(result.tournamentId).toBe(1);
    expect(result.dateNumber).toBe(1);
    expect(result.status).toBe('open');
    expect(result.betAmount).toBe(1500);
    expect(result.pozo).toBe(0);
    expect(tournamentRepo.findById).toHaveBeenCalledWith(1);
    expect(tournamentRepo.saveMatchDate).toHaveBeenCalledOnce();
  });

  it('creates a match date with custom bet amount', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });
    vi.mocked(tournamentRepo.findById).mockResolvedValue(tournament);

    const uc = new CreateDateUseCase(tournamentRepo);
    const result = await uc.execute({ tournamentId: 1, dateNumber: 2, betAmount: 2000 });

    expect(result.betAmount).toBe(2000);
  });

  it('throws TournamentNotFoundError when tournament does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    vi.mocked(tournamentRepo.findById).mockResolvedValue(null);

    const uc = new CreateDateUseCase(tournamentRepo);
    await expect(uc.execute({ tournamentId: 999, dateNumber: 1 })).rejects.toThrow(
      TournamentNotFoundError,
    );
    expect(tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
  });
});

// ── CloseDateUseCase ───────────────────────────────────────────────

describe('CloseDateUseCase', () => {
  const openDate = MatchDate.create({
    id: 10,
    tournamentId: 1,
    dateNumber: 1,
    status: 'open',
    pozo: 0,
    betAmount: 1500,
    createdAt: new Date(),
  });

  it('closes an open date and calculates pozo', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test', commission: 15 });

    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findById).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);

    const pozoCalc = new PozoCalculator();
    const uc = new CloseDateUseCase(tournamentRepo, ticketRepo, pozoCalc);
    const result = await uc.execute(10);

    // 5 tickets × 1500 = 7500 gross, 15% commission = 1125, pozo = 6375
    expect(result.status).toBe('closed');
    expect(result.pozo).toBe(6375);
    expect(result.ticketCount).toBe(5);
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledOnce();
  });

  it('throws MatchDateNotFoundError when date does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(null);

    const pozoCalc = new PozoCalculator();
    const uc = new CloseDateUseCase(tournamentRepo, ticketRepo, pozoCalc);
    await expect(uc.execute(999)).rejects.toThrow(MatchDateNotFoundError);
  });

  it('throws when trying to close an already closed date', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const closedDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'closed',
      pozo: 5000,
      betAmount: 1500,
      createdAt: new Date(),
    });
    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);

    const pozoCalc = new PozoCalculator();
    const uc = new CloseDateUseCase(tournamentRepo, ticketRepo, pozoCalc);
    await expect(uc.execute(10)).rejects.toThrow('Cannot close');
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
  });
});

// ── PublishResultsUseCase ──────────────────────────────────────────

describe('PublishResultsUseCase', () => {
  const closedDate = MatchDate.create({
    id: 10,
    tournamentId: 1,
    dateNumber: 1,
    status: 'closed',
    pozo: 6000,
    betAmount: 1500,
    createdAt: new Date(),
  });

  const matches = [
    Match.new({ id: 1, matchDateId: 10, localTeam: 'River', visitorTeam: 'Boca' }),
    Match.new({ id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente' }),
  ];

  const ticket = Ticket.new({
    id: 1,
    userId: 'user-1',
    matchDateId: 10,
    betAmount: 1500,
    predictions: [
      TicketPrediction.new({ matchId: 1, prediction: 'L' }),
      TicketPrediction.new({ matchId: 2, prediction: 'E' }),
    ],
  });

  it('publishes results and returns points', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();

    // Set results on matches
    const matchesWithResults = matches.map((m) => {
      if (m.id === 1) return m.setResult('L', '2-0');
      if (m.id === 2) return m.setResult('V', '1-0');
      return m;
    });

    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(matchesWithResults);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);

    const pointsCalculator = new PointsCalculator();
    const uc = new PublishResultsUseCase(
      tournamentRepo,
      matchRepo,
      ticketRepo,
      pointsCalculator,
    );
    const result = await uc.execute(10);

    expect(result.status).toBe('results');
    expect(result.points).toHaveLength(1);
    expect(result.points[0].ticketId).toBe(1);
    expect(result.points[0].correct).toBe(1); // L is correct, E is wrong
    expect(result.points[0].total).toBe(2);
  });

  it('throws MatchDateNotFoundError when date does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(null);

    const uc = new PublishResultsUseCase(
      tournamentRepo,
      createMatchRepoMocks(),
      createTicketRepoMocks(),
      new PointsCalculator(),
    );
    await expect(uc.execute(999)).rejects.toThrow(MatchDateNotFoundError);
  });

  it('throws when trying to publish results on an open date', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const openDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      createdAt: new Date(),
    });
    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(openDate);

    const uc = new PublishResultsUseCase(
      tournamentRepo,
      createMatchRepoMocks(),
      createTicketRepoMocks(),
      new PointsCalculator(),
    );
    await expect(uc.execute(10)).rejects.toThrow('Cannot publish results');
  });
});

// ── PointsCalculator ───────────────────────────────────────────────

describe('PointsCalculator', () => {
  it('counts correct predictions', () => {
    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '0-0'),
    ];
    const ticket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [
        TicketPrediction.new({ matchId: 1, prediction: 'L' }),
        TicketPrediction.new({ matchId: 2, prediction: 'E' }),
      ],
    });

    const calc = new PointsCalculator();
    const points = calc.calculate(matches, [ticket]);

    expect(points).toHaveLength(1);
    expect(points[0].correct).toBe(2);
    expect(points[0].total).toBe(2);
  });

  it('handles partial results (some matches without result)', () => {
    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('V', '0-2'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }), // no result yet
    ];
    const ticket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [
        TicketPrediction.new({ matchId: 1, prediction: 'V' }),
        TicketPrediction.new({ matchId: 2, prediction: 'L' }),
      ],
    });

    const calc = new PointsCalculator();
    const points = calc.calculate(matches, [ticket]);

    expect(points[0].correct).toBe(1); // only match 1 counted (V is correct)
    expect(points[0].total).toBe(1);    // only match 1 has a result
  });

  it('returns empty array when no tickets', () => {
    const matches = [Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' })];
    const calc = new PointsCalculator();
    const points = calc.calculate(matches, []);
    expect(points).toEqual([]);
  });

  it('sorts results by correct descending', () => {
    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '1-1'),
    ];
    const ticket1 = Ticket.new({
      id: 1, userId: 'u1', matchDateId: 10, betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'L' }), TicketPrediction.new({ matchId: 2, prediction: 'E' })],
    });
    const ticket2 = Ticket.new({
      id: 2, userId: 'u2', matchDateId: 10, betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'V' }), TicketPrediction.new({ matchId: 2, prediction: 'E' })],
    });

    const calc = new PointsCalculator();
    const points = calc.calculate(matches, [ticket1, ticket2]);

    expect(points[0].ticketId).toBe(1); // 2 correct
    expect(points[1].ticketId).toBe(2); // 1 correct
  });
});

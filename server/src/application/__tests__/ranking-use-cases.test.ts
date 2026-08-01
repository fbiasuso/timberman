import { describe, it, expect, vi } from 'vitest';
import { GetRankingUseCase } from '../ranking/get-ranking-use-case.js';
import { GetUserDetailUseCase } from '../ranking/get-user-detail-use-case.js';
import { PointsCalculator } from '../tournament/points-calculator.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { User } from '../../domain/entities/user.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import { Match } from '../../domain/entities/match.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { UserNotFoundError } from '../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

function createMocks() {
  const userRepo: UserRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };

  const ticketRepo: TicketRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByMatchDateId: vi.fn(),
    findByUserAndDate: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    countByMatchDateId: vi.fn(),
  };

  const matchRepo: MatchRepo = {
    findById: vi.fn(),
    findByMatchDateId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    saveMany: vi.fn(),
  };

  const tournamentRepo: TournamentRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn(),
  };

  return { userRepo, ticketRepo, matchRepo, tournamentRepo };
}

function makeUser(id: string, username: string): User {
  return User.create({
    id,
    username,
    passwordHash: 'hash',
    role: 'user',
    balance: 5000,
    createdAt: new Date(),
  });
}

function makeTicket(id: number, userId: string, matchDateId: number, predictions: Array<{ matchId: number; prediction: string }>): Ticket {
  return Ticket.new({
    id,
    userId,
    matchDateId,
    betAmount: 1500,
    predictions: predictions.map((p) => TicketPrediction.new({ matchId: p.matchId, prediction: p.prediction as 'L' | 'E' | 'V' })),
  });
}

// ── GetRankingUseCase ──────────────────────────────────────────────

describe('GetRankingUseCase', () => {
  it('returns entries sorted by points descending', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    const user1 = makeUser('u1', 'Alice');
    const user2 = makeUser('u2', 'Bob');
    vi.mocked(userRepo.findAll).mockResolvedValue([user1, user2]);

    // Alice has 2 points
    const t1 = makeTicket(1, 'u1', 10, [
      { matchId: 1, prediction: 'L' },
    ]);
    vi.mocked(ticketRepo.findByUserId).mockImplementation(async (uid) => {
      if (uid === 'u1') return [t1];
      if (uid === 'u2') return [makeTicket(2, 'u2', 10, [{ matchId: 1, prediction: 'V' }])];
      return [];
    });
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
    ]);

    const pointsCalc = new PointsCalculator();
    const uc = new GetRankingUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, pointsCalc);
    const ranking = await uc.execute();

    expect(ranking).toHaveLength(2);
    expect(ranking[0].userId).toBe('u1'); // Alice has 1 point
    expect(ranking[0].totalPoints).toBe(1);
    expect(ranking[0].position).toBe(1);
    expect(ranking[1].userId).toBe('u2'); // Bob has 0 points
    expect(ranking[1].totalPoints).toBe(0);
    expect(ranking[1].position).toBe(2);
  });

  it('handles ties: same points = same position', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    const user1 = makeUser('u1', 'Alice');
    const user2 = makeUser('u2', 'Bob');
    const user3 = makeUser('u3', 'Charlie');
    vi.mocked(userRepo.findAll).mockResolvedValue([user1, user2, user3]);

    // All have 1 point
    const t1 = makeTicket(1, 'u1', 10, [{ matchId: 1, prediction: 'L' }]);
    const t2 = makeTicket(2, 'u2', 10, [{ matchId: 1, prediction: 'L' }]);
    const t3 = makeTicket(3, 'u3', 10, [{ matchId: 1, prediction: 'L' }]);
    vi.mocked(ticketRepo.findByUserId).mockImplementation(async (uid) => {
      if (uid === 'u1') return [t1];
      if (uid === 'u2') return [t2];
      if (uid === 'u3') return [t3];
      return [];
    });
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
    ]);

    const pointsCalc = new PointsCalculator();
    const uc = new GetRankingUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, pointsCalc);
    const ranking = await uc.execute();

    expect(ranking).toHaveLength(3);
    expect(ranking[0].position).toBe(1);
    expect(ranking[1].position).toBe(1); // same points = same position
    expect(ranking[2].position).toBe(1); // all tied
  });

  it('filters by tournamentId', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findAll).mockResolvedValue([user]);

    // Ticket on matchDate 10 (tournament 1)
    const t1 = makeTicket(1, 'u1', 10, [{ matchId: 1, prediction: 'L' }]);
    // Ticket on matchDate 20 (tournament 2)
    const t2 = makeTicket(2, 'u1', 20, [{ matchId: 2, prediction: 'L' }]);
    vi.mocked(ticketRepo.findByUserId).mockResolvedValue([t1, t2]);

    // MatchDate 10 belongs to tournament 1, matchDate 20 belongs to tournament 2
    vi.mocked(tournamentRepo.findMatchDateById).mockImplementation(async (id: number) => {
      if (id === 10) return MatchDate.create({
        id: 10, tournamentId: 1, dateNumber: 1, status: 'results' as const, pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      });
      if (id === 20) return MatchDate.create({
        id: 20, tournamentId: 2, dateNumber: 1, status: 'results' as const, pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      });
      return null;
    });

    // Only matchDate 10 has results set (tournament 1)
    vi.mocked(matchRepo.findByMatchDateId).mockImplementation(async (id: number) => {
      if (id === 10) return [
        Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      ];
      return [
        Match.new({ id: 2, matchDateId: 20, localTeam: 'C', visitorTeam: 'D' }).setResult('L', '1-0'),
      ];
    });

    const pointsCalc = new PointsCalculator();
    const uc = new GetRankingUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, pointsCalc);
    const ranking = await uc.execute(1);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].totalPoints).toBe(1);
  });

  it('returns empty array when no users exist', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    vi.mocked(userRepo.findAll).mockResolvedValue([]);

    const pointsCalc = new PointsCalculator();
    const uc = new GetRankingUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, pointsCalc);
    const ranking = await uc.execute();

    expect(ranking).toEqual([]);
  });
});

// ── GetUserDetailUseCase ──────────────────────────────────────────

describe('GetUserDetailUseCase', () => {
  it('returns per-date breakdown for a user', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    const ticket = makeTicket(1, 'u1', 10, [
      { matchId: 1, prediction: 'L' },
      { matchId: 2, prediction: 'V' },
    ]);
    vi.mocked(ticketRepo.findByUserId).mockResolvedValue([ticket]);

    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(
      MatchDate.create({
        id: 10, tournamentId: 1, dateNumber: 3, status: 'results' as const,
        pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      }),
    );

    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '1-1'),
    ]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo);
    const details = await uc.execute('u1');

    expect(details).toHaveLength(1);
    expect(details[0].dateNumber).toBe(3);
    expect(details[0].correctPredictions).toBe(1); // L is correct, V is wrong
    expect(details[0].totalMatches).toBe(2);
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo);
    await expect(uc.execute('nonexistent')).rejects.toThrow(UserNotFoundError);
  });

  it('returns sorted by dateNumber descending', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    const t1 = makeTicket(1, 'u1', 10, [{ matchId: 1, prediction: 'L' }]);
    const t2 = makeTicket(2, 'u1', 20, [{ matchId: 2, prediction: 'L' }]);
    vi.mocked(ticketRepo.findByUserId).mockResolvedValue([t1, t2]);

    vi.mocked(tournamentRepo.findMatchDateById).mockImplementation(async (id: number) => {
      if (id === 10) return MatchDate.create({
        id: 10, tournamentId: 1, dateNumber: 1, status: 'results' as const, pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      });
      if (id === 20) return MatchDate.create({
        id: 20, tournamentId: 1, dateNumber: 5, status: 'results' as const, pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      });
      return null;
    });

    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo);
    const details = await uc.execute('u1');

    expect(details).toHaveLength(2);
    expect(details[0].dateNumber).toBe(5); // most recent first
    expect(details[1].dateNumber).toBe(1);
  });

  it('returns empty array when user has no tickets', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);
    vi.mocked(ticketRepo.findByUserId).mockResolvedValue([]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo);
    const details = await uc.execute('u1');
    expect(details).toEqual([]);
  });
});

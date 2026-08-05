import { describe, it, expect, vi } from 'vitest';
import { GetRankingUseCase } from '../ranking/get-ranking-use-case.js';
import { GetUserDetailUseCase } from '../ranking/get-user-detail-use-case.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';
import type { TournamentPoint } from '../../domain/ports/tournament-points-repo.js';
import { User } from '../../domain/entities/user.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import { Match } from '../../domain/entities/match.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { Tournament } from '../../domain/entities/tournament.js';
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
    createInitialTournament: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn(),
  };

  const tournamentPointsRepo: TournamentPointsRepo = {
    savePoints: vi.fn(),
    findByTournamentId: vi.fn(),
    findByUserAndTournament: vi.fn(),
    saveWinners: vi.fn(),
    findWinnersByTournamentId: vi.fn(),
  };

  return { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo };
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

function makePointRow(
  userId: string,
  tournamentId: number,
  matchDateId: number,
  points: number,
): TournamentPoint {
  return { userId, tournamentId, matchDateId, points };
}

function makeActiveTournament(id: number): Tournament {
  return Tournament.new({ id, name: `Torneo ${id}` });
}

// ── GetRankingUseCase ──────────────────────────────────────────────

describe('GetRankingUseCase', () => {
  it('aggregates persisted points per user, sorted descending, without ticket calls', async () => {
    const { userRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user1 = makeUser('u1', 'Alice');
    const user2 = makeUser('u2', 'Bob');
    const user3 = makeUser('u3', 'Charlie');
    vi.mocked(userRepo.findAll).mockResolvedValue([user1, user2, user3]);

    // Alice: 3 pts (dates 1+2), Bob: 1 pt, Charlie: 0 pts (0-point row persists)
    vi.mocked(tournamentPointsRepo.findByTournamentId).mockResolvedValue([
      makePointRow('u1', 1, 1, 2),
      makePointRow('u1', 1, 2, 1),
      makePointRow('u2', 1, 1, 1),
      makePointRow('u3', 1, 1, 0),
    ]);

    const uc = new GetRankingUseCase(userRepo, tournamentRepo, tournamentPointsRepo);
    const ranking = await uc.execute(1);

    expect(ranking).toHaveLength(3);
    expect(ranking[0]).toMatchObject({ userId: 'u1', totalPoints: 3, position: 1 });
    expect(ranking[1]).toMatchObject({ userId: 'u2', totalPoints: 1, position: 2 });
    expect(ranking[2]).toMatchObject({ userId: 'u3', totalPoints: 0, position: 3 });

    // Points come ONLY from persisted rows — no ticket/matches reads
    expect(tournamentPointsRepo.findByTournamentId).toHaveBeenCalledWith(1);
    expect(vi.mocked(userRepo.findAll)).toHaveBeenCalledOnce();
  });

  it('resolves the active tournament when tournamentId is omitted', async () => {
    const { userRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findAll).mockResolvedValue([user]);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(makeActiveTournament(5));
    vi.mocked(tournamentPointsRepo.findByTournamentId).mockResolvedValue([
      makePointRow('u1', 5, 1, 2),
    ]);

    const uc = new GetRankingUseCase(userRepo, tournamentRepo, tournamentPointsRepo);
    const ranking = await uc.execute();

    expect(tournamentRepo.findActive).toHaveBeenCalledOnce();
    expect(tournamentPointsRepo.findByTournamentId).toHaveBeenCalledWith(5);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].userId).toBe('u1');
  });

  it('returns an empty ranking when no tournament is active', async () => {
    const { userRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(null);

    const uc = new GetRankingUseCase(userRepo, tournamentRepo, tournamentPointsRepo);
    const ranking = await uc.execute();

    expect(ranking).toEqual([]);
    // No points read, no user reads
    expect(tournamentPointsRepo.findByTournamentId).not.toHaveBeenCalled();
    expect(vi.mocked(userRepo.findAll)).not.toHaveBeenCalled();
  });

  it('handles ties: same points share the same position, ordered deterministically', async () => {
    const { userRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user1 = makeUser('u1', 'Alice');
    const user2 = makeUser('u2', 'Bob');
    const user3 = makeUser('u3', 'Charlie');
    vi.mocked(userRepo.findAll).mockResolvedValue([user1, user2, user3]);

    // All have 1 point — deterministic order: Alice, Bob, Charlie (by username)
    vi.mocked(tournamentPointsRepo.findByTournamentId).mockResolvedValue([
      makePointRow('u2', 1, 1, 1),
      makePointRow('u1', 1, 1, 1),
      makePointRow('u3', 1, 1, 1),
    ]);

    const uc = new GetRankingUseCase(userRepo, tournamentRepo, tournamentPointsRepo);
    const ranking = await uc.execute(1);

    expect(ranking).toHaveLength(3);
    expect(ranking.map((r) => r.username)).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(ranking[0].position).toBe(1);
    expect(ranking[1].position).toBe(1); // same points = same position
    expect(ranking[2].position).toBe(1); // all tied
  });

  it('keeps users with 0 total points (persisted 0-point rows are not filtered)', async () => {
    const { userRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Zero');
    vi.mocked(userRepo.findAll).mockResolvedValue([user]);
    vi.mocked(tournamentPointsRepo.findByTournamentId).mockResolvedValue([
      makePointRow('u1', 1, 1, 0),
    ]);

    const uc = new GetRankingUseCase(userRepo, tournamentRepo, tournamentPointsRepo);
    const ranking = await uc.execute(1);

    expect(ranking).toHaveLength(1);
    expect(ranking[0]).toMatchObject({ userId: 'u1', totalPoints: 0, position: 1 });
  });

  it('excludes users without any persisted row for the tournament', async () => {
    const { userRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user1 = makeUser('u1', 'Alice');
    const user2 = makeUser('u2', 'NoPoints');
    vi.mocked(userRepo.findAll).mockResolvedValue([user1, user2]);
    vi.mocked(tournamentPointsRepo.findByTournamentId).mockResolvedValue([
      makePointRow('u1', 1, 1, 2),
    ]);

    const uc = new GetRankingUseCase(userRepo, tournamentRepo, tournamentPointsRepo);
    const ranking = await uc.execute(1);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].userId).toBe('u1');
  });
});

// ── GetUserDetailUseCase ──────────────────────────────────────────

describe('GetUserDetailUseCase', () => {
  function makeTicket(userId: string, matchDateId: number): Ticket {
    return Ticket.new({
      id: 1,
      userId,
      matchDateId,
      betAmount: 1500,
      predictions: [
        TicketPrediction.new({ matchId: 1, prediction: 'L' }),
        TicketPrediction.new({ matchId: 2, prediction: 'V' }),
      ],
    });
  }

  it('returns per-date breakdown from persisted points with recomputed details', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    // Persisted row for the paid date (2 pts)
    vi.mocked(tournamentPointsRepo.findByUserAndTournament).mockResolvedValue([
      makePointRow('u1', 1, 10, 2),
    ]);

    vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(
      MatchDate.create({
        id: 10, tournamentId: 1, dateNumber: 3, status: 'results' as const,
        pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      }),
    );

    vi.mocked(ticketRepo.findByUserAndDate).mockResolvedValue(makeTicket('u1', 10));

    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '1-1'),
    ]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo);
    const details = await uc.execute('u1', 1);

    expect(details).toHaveLength(1);
    expect(details[0].dateNumber).toBe(3);
    expect(details[0].points).toBe(2); // persisted points
    expect(details[0].correctPredictions).toBe(1); // L correct, V wrong
    expect(details[0].totalMatches).toBe(2);
  });

  it('resolves the active tournament when tournamentId is omitted', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(makeActiveTournament(5));
    vi.mocked(tournamentPointsRepo.findByUserAndTournament).mockResolvedValue([]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo);
    const details = await uc.execute('u1');

    expect(tournamentRepo.findActive).toHaveBeenCalledOnce();
    expect(tournamentPointsRepo.findByUserAndTournament).toHaveBeenCalledWith('u1', 5);
    expect(details).toEqual([]);
  });

  it('returns empty breakdown when no tournament is active', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(null);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo);
    const details = await uc.execute('u1');

    expect(details).toEqual([]);
    expect(tournamentPointsRepo.findByUserAndTournament).not.toHaveBeenCalled();
  });

  it('is per-tournament: the same user in two tournaments gets different totals', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    // Tournament 1: one paid date with 3 pts; Tournament 2: two paid dates (2+1)
    vi.mocked(tournamentPointsRepo.findByUserAndTournament).mockImplementation(
      async (uid, tournamentId) => {
        if (tournamentId === 1) return [makePointRow(uid, 1, 10, 3)];
        if (tournamentId === 2) return [
          makePointRow(uid, 2, 20, 2),
          makePointRow(uid, 2, 21, 1),
        ];
        return [];
      },
    );

    vi.mocked(tournamentRepo.findMatchDateById).mockImplementation(async (id: number) => {
      const byId: Record<number, { tournamentId: number; dateNumber: number }> = {
        10: { tournamentId: 1, dateNumber: 1 },
        20: { tournamentId: 2, dateNumber: 2 },
        21: { tournamentId: 2, dateNumber: 3 },
      };
      const info = byId[id];
      if (!info) return null;
      return MatchDate.create({
        id, tournamentId: info.tournamentId, dateNumber: info.dateNumber,
        status: 'results' as const, pozo: 5000, betAmount: 1500, commission: 0,
        createdAt: new Date(),
      });
    });
    vi.mocked(ticketRepo.findByUserAndDate).mockResolvedValue(makeTicket('u1', 10));
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
    ]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo);

    const t1 = await uc.execute('u1', 1);
    const t2 = await uc.execute('u1', 2);

    expect(t1).toHaveLength(1);
    expect(t1[0].points).toBe(3);
    expect(t2).toHaveLength(2);
    expect(t2.map((d) => d.points).sort()).toEqual([1, 2]);
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo);
    await expect(uc.execute('nonexistent')).rejects.toThrow(UserNotFoundError);
  });

  it('returns sorted by dateNumber descending', async () => {
    const { userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo } = createMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    vi.mocked(tournamentPointsRepo.findByUserAndTournament).mockResolvedValue([
      makePointRow('u1', 1, 10, 1),
      makePointRow('u1', 1, 20, 2),
    ]);

    vi.mocked(tournamentRepo.findMatchDateById).mockImplementation(async (id: number) => {
      const dateNumber = id === 10 ? 1 : 5;
      return MatchDate.create({
        id, tournamentId: 1, dateNumber, status: 'results' as const,
        pozo: 5000, betAmount: 1500, commission: 0, createdAt: new Date(),
      });
    });
    vi.mocked(ticketRepo.findByUserAndDate).mockResolvedValue(null);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([]);

    const uc = new GetUserDetailUseCase(userRepo, ticketRepo, matchRepo, tournamentRepo, tournamentPointsRepo);
    const details = await uc.execute('u1', 1);

    expect(details).toHaveLength(2);
    expect(details[0].dateNumber).toBe(5); // most recent first
    expect(details[1].dateNumber).toBe(1);
  });
});

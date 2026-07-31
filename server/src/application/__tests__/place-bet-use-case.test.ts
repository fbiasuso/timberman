import { describe, it, expect, vi } from 'vitest';
import { PlaceBetUseCase } from '../betting/place-bet-use-case.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import { User } from '../../domain/entities/user.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { Match } from '../../domain/entities/match.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  MatchDateNotFoundError,
  DateNotOpenError,
  DuplicateBetError,
  InsufficientBalanceError,
} from '../../domain/errors/index.js';

function createMocks() {
  const userRepo: UserRepo = {
    findById: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn(),
    update: vi.fn((user: any) => Promise.resolve(user)),
    findAll: vi.fn(),
    delete: vi.fn(),
  };

  const tournamentRepo: TournamentRepo = {
    findById: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn(),
  };

  const matchRepo: MatchRepo = {
    findById: vi.fn(),
    findByMatchDateId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    saveMany: vi.fn(),
  };

  const ticketRepo: TicketRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByMatchDateId: vi.fn(),
    findByUserAndDate: vi.fn(),
    save: vi.fn((ticket: any) => {
      // Preserve the Ticket class instance (getters like betAmount)
      // Override id to simulate DB-assigned value
      const snapshot = ticket.toSnapshot();
      snapshot.id = 42;
      return Promise.resolve(Ticket.create(snapshot, ticket.predictions));
    }),
    countByMatchDateId: vi.fn(),
  };

  return { userRepo, tournamentRepo, matchRepo, ticketRepo };
}

describe('PlaceBetUseCase', () => {
  const openDate = MatchDate.create({
    id: 10,
    tournamentId: 1,
    dateNumber: 1,
    status: 'open',
    pozo: 0,
    betAmount: 1500,
    commission: 0,
    createdAt: new Date(),
  });

  const matches = [
    Match.new({ id: 1, matchDateId: 10, localTeam: 'River', visitorTeam: 'Boca' }),
    Match.new({ id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente' }),
  ];

  const user = User.create({
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    role: 'user',
    balance: 5000,
    createdAt: new Date(),
  });

  describe('successful bet placement', () => {
    it('creates a ticket and deducts balance', async () => {
      const { userRepo, tournamentRepo, matchRepo, ticketRepo } = createMocks();
      vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      vi.mocked(ticketRepo.findByUserAndDate).mockResolvedValue(null);
      vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(matches);

      const uc = new PlaceBetUseCase(userRepo, tournamentRepo, matchRepo, ticketRepo);
      const result = await uc.execute({
        userId: 'user-1',
        matchDateId: 10,
        predictions: { '1': 'L', '2': 'E' },
      });

      expect(result.userId).toBe('user-1');
      expect(result.matchDateId).toBe(10);
      expect(result.betAmount).toBe(1500);
      expect(result.predictions).toHaveLength(2);
      expect(ticketRepo.save).toHaveBeenCalledOnce();
      expect(userRepo.update).toHaveBeenCalledOnce();
      // User balance should be deducted
      const updatedUser = vi.mocked(userRepo.update).mock.calls[0][0];
      expect(updatedUser.balance.cents).toBe(3500);
    });
  });

  describe('insufficient balance', () => {
    it('throws InsufficientBalanceError when user cannot afford bet', async () => {
      const { userRepo, tournamentRepo, matchRepo, ticketRepo } = createMocks();
      const poorUser = User.create({
        id: 'user-2',
        username: 'poor',
        passwordHash: 'hash',
        role: 'user',
        balance: 500,
        createdAt: new Date(),
      });

      vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(userRepo.findById).mockResolvedValue(poorUser);

      const uc = new PlaceBetUseCase(userRepo, tournamentRepo, matchRepo, ticketRepo);
      await expect(
        uc.execute({ userId: 'user-2', matchDateId: 10, predictions: { '1': 'L' } }),
      ).rejects.toThrow(InsufficientBalanceError);
    });
  });

  describe('duplicate ticket', () => {
    it('throws DuplicateBetError when user already has a bet on this date', async () => {
      const { userRepo, tournamentRepo, matchRepo, ticketRepo } = createMocks();
      vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      vi.mocked(ticketRepo.findByUserAndDate).mockResolvedValue({ id: 99 } as any);

      const uc = new PlaceBetUseCase(userRepo, tournamentRepo, matchRepo, ticketRepo);
      await expect(
        uc.execute({ userId: 'user-1', matchDateId: 10, predictions: { '1': 'L' } }),
      ).rejects.toThrow(DuplicateBetError);
    });
  });

  describe('closed date', () => {
    it('throws DateNotOpenError when match date is not open', async () => {
      const { userRepo, tournamentRepo, matchRepo, ticketRepo } = createMocks();
      const closedDate = MatchDate.create({
        id: 10,
        tournamentId: 1,
        dateNumber: 1,
        status: 'closed',
        pozo: 0,
        betAmount: 1500,
        commission: 0,
        createdAt: new Date(),
      });
      vi.mocked(tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);

      const uc = new PlaceBetUseCase(userRepo, tournamentRepo, matchRepo, ticketRepo);
      await expect(
        uc.execute({ userId: 'user-1', matchDateId: 10, predictions: { '1': 'L' } }),
      ).rejects.toThrow(DateNotOpenError);
    });
  });
});

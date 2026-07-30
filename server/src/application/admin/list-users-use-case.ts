import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import { PointsCalculator } from '../tournament/points-calculator.js';

// ── DTOs ──────────────────────────────────────────────────────────

/**
 * Public user data — no password hash exposed.
 */
export interface AdminUserDTO {
  id: string;
  username: string;
  role: string;
  balance: number;
  totalPoints: number;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Returns all users without sensitive fields (password hash).
 * Includes totalPoints computed from the user's ticket history.
 */
export class ListUsersUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly matchRepo: MatchRepo,
    private readonly pointsCalculator: PointsCalculator,
  ) {}

  async execute(): Promise<AdminUserDTO[]> {
    const users = await this.userRepo.findAll();
    const result: AdminUserDTO[] = [];

    for (const user of users) {
      const snap = user.toSnapshot();
      const tickets = await this.ticketRepo.findByUserId(user.id);

      let totalPoints = 0;
      for (const ticket of tickets) {
        const matches = await this.matchRepo.findByMatchDateId(ticket.matchDateId);
        const points = this.pointsCalculator.calculate(matches, [ticket]);
        if (points.length > 0) {
          totalPoints += points[0].correct;
        }
      }

      result.push({
        id: snap.id,
        username: snap.username,
        role: snap.role,
        balance: snap.balance,
        totalPoints,
        createdAt: snap.createdAt,
      });
    }

    return result;
  }
}

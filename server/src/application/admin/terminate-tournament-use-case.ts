import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import {
  TournamentNotFoundError,
  TournamentOpenDateError,
  TournamentNotActiveError,
} from '../../domain/errors/index.js';
import { AuditLog } from '../../domain/entities/audit-log.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface TerminateWinnerDTO {
  userId: string;
  username: string;
  /** Total tournament points of the winner (the shared maximum) */
  points: number;
}

export interface TerminateTournamentResult {
  id: number;
  name: string;
  status: string;
  finishedAt: Date | null;
  winners: TerminateWinnerDTO[];
  /** Cents — frozen at terminate; never transferred on archive (spec) */
  carryover: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Terminate an active tournament: transitions it to 'finished' and freezes
 * the winner(s).
 *
 * Winners are ALL users tied at the maximum total tournament points read
 * from the persisted `tournament_points` rows — but only when that maximum
 * is greater than zero (a tournament with no points has no winners and no
 * `saveWinners` write). The winner user IDs are persisted to
 * `tournament_winners`; no balance, pozo, or prize is touched — prize
 * payment is a future stub (spec prize-payouts).
 *
 * Guards, in order:
 * 1. Tournament must exist (404) — row locked FOR UPDATE.
 * 2. Tournament must be 'active' (422).
 * 3. Tournament must have NO open match date (409) — a betting round in
 *    flight cannot be frozen mid-bet.
 *
 * When a UnitOfWork is provided the whole flow (lock, status update,
 * winners write, audit) commits or rolls back as a single transaction.
 */
export class TerminateTournamentUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly tournamentPointsRepo: TournamentPointsRepo,
    private readonly userRepo: UserRepo,
    private readonly auditLogRepo: AuditLogRepo,
    private readonly uow?: UnitOfWork,
  ) {}

  async execute(adminId: string, tournamentId: number): Promise<TerminateTournamentResult> {
    if (this.uow) {
      return this.uow.withTransaction((repos) =>
        this.terminate(adminId, tournamentId, repos),
      );
    }
    return this.terminate(adminId, tournamentId, {
      tournamentRepo: this.tournamentRepo,
      tournamentPointsRepo: this.tournamentPointsRepo,
      userRepo: this.userRepo,
      auditLogRepo: this.auditLogRepo,
    });
  }

  private async terminate(
    adminId: string,
    tournamentId: number,
    repos: Pick<
      TransactionRepos,
      'tournamentRepo' | 'tournamentPointsRepo' | 'userRepo' | 'auditLogRepo'
    >,
  ): Promise<TerminateTournamentResult> {
    const { tournamentRepo, tournamentPointsRepo, userRepo, auditLogRepo } = repos;

    // 1. Lock the tournament row — serializes concurrent terminate/archive on
    //    the SAME tournament (a second request blocks here, then reads the
    //    committed status and is rejected with 422).
    const tournament = await tournamentRepo.findByIdForUpdate(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(tournamentId);
    }

    // 2. Active-only guard — terminate freezes the CURRENT round
    if (tournament.status !== 'active') {
      throw new TournamentNotActiveError(tournamentId, tournament.status);
    }

    // 3. No open betting round may be in flight when freezing the tournament
    const openDates = await tournamentRepo.findOpenMatchDates(tournamentId);
    if (openDates.length > 0) {
      throw new TournamentOpenDateError(tournamentId);
    }

    // 4. Winners: all users tied at the max total persisted points (> 0 only).
    //    Persisted rows already include 0-point owners, so no user with rows
    //    is skipped — a max of 0 means nobody scored.
    const rows = await tournamentPointsRepo.findByTournamentId(tournamentId);
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.points);
    }
    const maxTotal = totals.size > 0 ? Math.max(...totals.values()) : 0;
    const winnerUserIds =
      maxTotal > 0
        ? [...totals.entries()]
            .filter(([, points]) => points === maxTotal)
            .map(([userId]) => userId)
        : [];

    // 5. Persist the status transition (entity enforces the active guard)
    const finished = tournament.finish();
    const saved = await tournamentRepo.update(finished);

    // 6. Persist winners ONLY when the maximum is greater than zero
    if (winnerUserIds.length > 0) {
      await tournamentPointsRepo.saveWinners(tournamentId, winnerUserIds);
    }

    // 7. Audit trail
    const auditLog = AuditLog.new({
      id: 0,
      adminId,
      action: 'tournament_finished',
      reason: JSON.stringify({ tournamentId, winners: winnerUserIds }),
    });
    await auditLogRepo.save(auditLog);

    // Usernames for the DTO — one batch read (same pattern as GetRanking)
    const users = await userRepo.findAll();
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    const snap = saved.toSnapshot();
    return {
      id: snap.id,
      name: snap.name,
      status: snap.status,
      finishedAt: snap.finishedAt,
      winners: winnerUserIds.map((userId) => ({
        userId,
        username: usernameById.get(userId) ?? 'unknown',
        points: maxTotal,
      })),
      carryover: snap.carryover,
    };
  }
}

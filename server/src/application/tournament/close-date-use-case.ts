import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import { PozoCalculator } from '../betting/pozo-calculator.js';
import { Money } from '../../domain/value-objects/money.js';
import { Commission } from '../../domain/value-objects/commission.js';
import { AuditLog } from '../../domain/entities/audit-log.js';
import type { SystemConfig } from '../../domain/entities/system-config.js';
import {
  MatchDateNotFoundError,
  TournamentNotFoundError,
  UserNotFoundError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CloseDateResult {
  id: number;
  status: string;
  pozo: number; // cents — bets pozo + consumed carryover
  ticketCount: number;
  commission: number; // cents — house cut credited to the closing admin
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Close a match date for betting and calculate the prize pool.
 *
 * Financial flow (per tournament-management spec):
 * 1. Find the match date and verify it's open
 * 2. Find the parent tournament for its accumulated carryover — the row
 *    is locked FOR UPDATE inside the transaction so two dates closed
 *    concurrently can never double-consume the carryover
 * 3. Count all tickets placed on this date
 * 4. Calculate pozo = (tickets × betAmount) − commission at the LIVE
 *    system-config rate; the carryover is added on top and consumed
 * 5. Snapshot pozo + commission on the date (never recomputed later)
 * 6. Reset the tournament carryover to 0
 * 7. Credit the house commission to the closing admin (from the JWT)
 * 8. Write a `commission_payout` audit entry
 *
 * Every write (status transition, carryover reset, admin credit, audit
 * entry) happens inside ONE database transaction: a failure anywhere
 * rolls everything back, so a mid-flow error can never leave a
 * partially-closed date or a consumed carryover without the credit.
 */
export class CloseDateUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly pozoCalculator: PozoCalculator,
    private readonly config: SystemConfig,
    private readonly userRepo: UserRepo,
    private readonly auditLogRepo: AuditLogRepo,
    private readonly uow?: UnitOfWork,
  ) {}

  async execute(matchDateId: number, adminId: string): Promise<CloseDateResult> {
    if (this.uow) {
      return this.uow.withTransaction((repos) => this.close(matchDateId, adminId, repos));
    }
    return this.close(matchDateId, adminId, {
      tournamentRepo: this.tournamentRepo,
      ticketRepo: this.ticketRepo,
      userRepo: this.userRepo,
      auditLogRepo: this.auditLogRepo,
    });
  }

  private async close(
    matchDateId: number,
    adminId: string,
    repos: Pick<TransactionRepos, 'tournamentRepo' | 'ticketRepo' | 'userRepo' | 'auditLogRepo'>,
  ): Promise<CloseDateResult> {
    const { tournamentRepo, ticketRepo, userRepo, auditLogRepo } = repos;

    // 1. Load match date
    const matchDate = await tournamentRepo.findMatchDateById(matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(matchDateId);
    }

    // 2. Close it (domain transition — throws if not open)
    const closed = matchDate.close();

    // 3. Find tournament for its carryover — locked FOR UPDATE so the
    //    read-modify-write below cannot race with another concurrent close
    const tournament = await tournamentRepo.findByIdForUpdate(closed.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(closed.tournamentId);
    }

    // 4. Count tickets placed on this date
    const ticketCount = await ticketRepo.countByMatchDateId(matchDateId);

    // 5. Calculate pozo at the LIVE system-config rate (the tournament
    //    commission field is informational and never feeds the calculation)
    const rate = Commission.create(this.config.commission);
    const pozoBase = this.pozoCalculator.calculate(
      ticketCount,
      closed.betAmount,
      rate,
    ).cents;
    const gross = ticketCount * closed.betAmount.cents;
    const commissionCents = gross - pozoBase;

    // 6. Pozo = bets pozo + carryover accumulated from unpaid previous dates
    const pozo = Money.fromCents(pozoBase + tournament.carryover);

    // 7. Persist the date with pozo + commission snapshot
    const updated = closed.withPozo(pozo).withCommission(this.config.commission);
    const saved = await tournamentRepo.updateMatchDate(updated);

    // 8. Consume the carryover — it is now part of this date's pozo
    await tournamentRepo.update(tournament.withCarryover(0));

    // 9. Credit the house commission to the closing admin + audit trail
    if (commissionCents > 0) {
      const admin = await userRepo.findById(adminId);
      if (!admin) {
        throw new UserNotFoundError(adminId);
      }
      await userRepo.update(admin.addBalance(Money.fromCents(commissionCents)));

      const auditLog = AuditLog.new({
        id: 0,
        adminId,
        action: 'commission_payout',
        amount: commissionCents,
        reason: `Commission payout for match date ${matchDateId}`,
      });
      await auditLogRepo.save(auditLog);
    }

    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      status: snap.status,
      pozo: snap.pozo,
      ticketCount,
      commission: commissionCents,
    };
  }
}

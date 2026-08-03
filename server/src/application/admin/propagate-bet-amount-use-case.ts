import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import { Money } from '../../domain/value-objects/money.js';
import { AuditLog } from '../../domain/entities/audit-log.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface PropagateBetAmountResultEntry {
  id: number;
  dateNumber: number;
}

export interface PropagateBetAmountResult {
  updatedDates: PropagateBetAmountResultEntry[];
  blockedDates: PropagateBetAmountResultEntry[];
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Propagates the new default bet amount to every open, ticket-free match date
 * across all active tournaments. Dates that already have tickets keep their
 * current amount and are reported as blocked — never thrown.
 *
 * Transaction guarantees (inside UoW):
 * 1. The open-date list is read once.
 * 2. Each date is locked FOR UPDATE before the ticket count is checked so a
 *    concurrent bet-placing request serializes its INSERT after this check,
 *    guaranteeing at-most-once propagation.
 * 3. Date updates and both audit rows commit or roll back as a single unit.
 *
 * Configuration persistence is NOT part of this use case (req 3 in the spec:
 * config MUST save even when every date is blocked). The route handler
 * composes `UpdateConfigUseCase.execute(...)` before calling this.
 */
export class PropagateBetAmountUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly auditLogRepo: AuditLogRepo,
    private readonly uow?: UnitOfWork,
  ) {}

  async execute(
    adminId: string,
    betAmount: Money,
  ): Promise<PropagateBetAmountResult> {
    if (this.uow) {
      return this.uow.withTransaction((repos) =>
        this.propagate(adminId, betAmount, repos),
      );
    }
    return this.propagate(adminId, betAmount, {
      tournamentRepo: this.tournamentRepo,
      ticketRepo: this.ticketRepo,
      auditLogRepo: this.auditLogRepo,
    });
  }

  private async propagate(
    adminId: string,
    betAmount: Money,
    repos: Pick<
      TransactionRepos,
      'tournamentRepo' | 'ticketRepo' | 'auditLogRepo'
    >,
  ): Promise<PropagateBetAmountResult> {
    const { tournamentRepo, ticketRepo, auditLogRepo } = repos;

    // 1. Read all open dates (no tournament filter — see design D4)
    const openDates = await tournamentRepo.findOpenMatchDates();

    const updatedDates: PropagateBetAmountResultEntry[] = [];
    const blockedDates: PropagateBetAmountResultEntry[] = [];

    // 2. Per-date: lock row, check ticket count, update or block
    for (const date of openDates) {
      // Row-level lock — serializes concurrent bet placement
      const locked = await tournamentRepo.findMatchDateByIdForUpdate(date.id);
      if (!locked) {
        // Rare edge case: date was deleted between findOpenMatchDates and now
        continue;
      }

      const ticketCount = await ticketRepo.countByMatchDateId(locked.id);
      const entry: PropagateBetAmountResultEntry = {
        id: locked.id,
        dateNumber: locked.dateNumber,
      };

      if (ticketCount === 0) {
        const updated = locked.withBetAmount(betAmount);
        await tournamentRepo.updateMatchDate(updated);
        updatedDates.push(entry);
      } else {
        blockedDates.push(entry);
      }
    }

    // 3. Write both audit rows
    const amountCents = betAmount.cents;

    const configAudit = AuditLog.new({
      id: 0,
      adminId,
      action: 'default_bet_amount_update',
      amount: amountCents,
    });
    await auditLogRepo.save(configAudit);

    const propagationAudit = AuditLog.new({
      id: 0,
      adminId,
      action: 'default_bet_amount_propagation',
      amount: amountCents,
      reason: JSON.stringify({
        changed: updatedDates.map((d) => d.id),
        blocked: blockedDates.map((d) => d.id),
      }),
    });
    await auditLogRepo.save(propagationAudit);

    return { updatedDates, blockedDates };
  }
}
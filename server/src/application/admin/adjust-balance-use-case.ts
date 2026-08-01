import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import { UserNotFoundError } from '../../domain/errors/index.js';
import { Money } from '../../domain/value-objects/money.js';
import { AuditLog } from '../../domain/entities/audit-log.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface AdjustBalanceInput {
  userId: string;
  adminId: string;
  amount: number; // cents — positive to add, negative to deduct
  reason: string;
}

export interface AdjustBalanceResult {
  userId: string;
  username: string;
  previousBalance: number;
  newBalance: number;
  adjustedAmount: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Admin adjusts a user's balance (positive = deposit, negative = charge).
 * Creates an AuditLog entry for the adjustment.
 *
 * Financial flow (same guarantees as close/publish): the user row is read
 * FOR UPDATE inside the transaction so this read-modify-write serializes
 * with a concurrent bet deduction or winner payout on the SAME user — the
 * adjustment can never be clobbered by a lost write. The balance update
 * and the audit entry commit or roll back together.
 */
export class AdjustBalanceUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly auditLogRepo: AuditLogRepo,
    private readonly uow?: UnitOfWork,
  ) {}

  async execute(input: AdjustBalanceInput): Promise<AdjustBalanceResult> {
    if (this.uow) {
      return this.uow.withTransaction((repos) => this.adjust(input, repos));
    }
    return this.adjust(input, {
      userRepo: this.userRepo,
      auditLogRepo: this.auditLogRepo,
    });
  }

  private async adjust(
    input: AdjustBalanceInput,
    repos: Pick<TransactionRepos, 'userRepo' | 'auditLogRepo'>,
  ): Promise<AdjustBalanceResult> {
    const { userRepo, auditLogRepo } = repos;

    // Lock the user row FOR UPDATE (innermost lock level, same as the
    // betting flow) so a concurrent bet deduction or payout can never
    // clobber this adjustment. Never the unlocked plain read.
    const user = await userRepo.findByIdForUpdate(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    const previousBalance = user.balance.cents;

    // Apply the adjustment
    const adjustment = Money.fromCents(Math.abs(input.amount));
    let updatedUser = user;

    if (input.amount >= 0) {
      updatedUser = user.addBalance(adjustment);
    } else {
      updatedUser = user.deductBalance(adjustment);
    }

    // Persist updated user
    const saved = await userRepo.update(updatedUser);

    // Create audit log
    const auditLog = AuditLog.new({
      id: 0,
      adminId: input.adminId,
      userId: input.userId,
      action: input.amount >= 0 ? 'BALANCE_ADJUSTMENT_ADD' : 'BALANCE_ADJUSTMENT_DEDUCT',
      amount: input.amount,
      reason: input.reason,
    });
    await auditLogRepo.save(auditLog);

    const snap = saved.toSnapshot();

    return {
      userId: snap.id,
      username: snap.username,
      previousBalance,
      newBalance: snap.balance,
      adjustedAmount: input.amount,
    };
  }
}

import type { TournamentRepo } from './tournament-repo.js';
import type { MatchRepo } from './match-repo.js';
import type { TicketRepo } from './ticket-repo.js';
import type { UserRepo } from './user-repo.js';
import type { AuditLogRepo } from './audit-log-repo.js';

/**
 * Repositories bound to a single database transaction.
 *
 * Every method call on these repos runs inside the transaction opened by
 * `UnitOfWork.withTransaction`. If the callback throws, the transaction
 * rolls back — nothing is persisted.
 */
export interface TransactionRepos {
  tournamentRepo: TournamentRepo;
  matchRepo: MatchRepo;
  ticketRepo: TicketRepo;
  userRepo: UserRepo;
  auditLogRepo: AuditLogRepo;
}

/**
 * Transaction boundary port for multi-write financial flows.
 *
 * The use case orchestrates the business logic; the infrastructure
 * implementation owns the actual database transaction (including row
 * locks) and provides transaction-bound repos to the callback.
 */
export interface UnitOfWork {
  withTransaction<T>(fn: (repos: TransactionRepos) => Promise<T>): Promise<T>;
}
